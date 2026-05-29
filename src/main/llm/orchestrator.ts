import { createHash } from 'crypto'
import type { LLMJob, LLMJobType, ReferencedPaperValidationResult } from '../../shared/kg3'
import { callLlm } from './client'
import { paperMemoryRepository } from '../memory/kg3Repository'

const PROMPT_VERSION = 'kg3-2026-05-29'

const KG4_JOB_TYPES = new Set<LLMJobType>([
  'expand_node_retrieve_context',
  'extract_algorithm_ideas',
  'build_field_cognition_map',
  'generate_expansion_graph',
  'compare_algorithm_ideas',
  'generate_reflective_feedback',
  'generate_remedial_lesson',
  'suggest_graph_fusion',
  'generate_optional_transfer_task'
])

function now(): string {
  return new Date().toISOString()
}

function hashInput(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function jobId(type: LLMJobType, inputHash: string): string {
  return `job_${type}_${inputHash.slice(0, 16)}`
}

export class LLMTaskOrchestrator {
  private readonly running = new Map<string, AbortController>()
  private readonly queue: string[] = []
  private activeCount = 0
  private readonly maxConcurrent = 1

  async createJob(params: {
    type: LLMJobType
    input: unknown
    priority?: LLMJob['priority']
    paperId?: string
    nodeId?: string
    sessionId?: string
    taskId?: string
    relatedPaperIds?: string[]
    jsonMode?: boolean
    maxTokens?: number
    temperature?: number
  }): Promise<LLMJob> {
    const inputHash = hashInput(params.input)
    const cacheKey = [params.type, PROMPT_VERSION, 'deepseek-chat', inputHash, params.nodeId, params.paperId, ...(params.relatedPaperIds ?? [])]
      .filter(Boolean)
      .join(':')
    const snapshot = await paperMemoryRepository.getSnapshot()
    const cached = snapshot.llmJobs.find((job) => job.cacheKey === cacheKey && job.status === 'succeeded')
    if (cached) {
      const cacheHit: LLMJob = { ...cached, id: jobId(params.type, `${inputHash}:hit`), status: 'cache_hit', finishedAt: now() }
      await paperMemoryRepository.saveLLMJob(cacheHit)
      return cacheHit
    }

    const job: LLMJob = {
      id: jobId(params.type, inputHash),
      type: params.type,
      status: params.type === 'expand_node' ? 'waiting_for_retrieval' : 'queued',
      priority: params.priority ?? 'normal',
      inputHash,
      cacheKey,
      paperId: params.paperId,
      nodeId: params.nodeId,
      sessionId: params.sessionId,
      taskId: params.taskId,
      relatedPaperIds: params.relatedPaperIds ?? [],
      inputJson: params.input,
      promptVersion: PROMPT_VERSION,
      model: 'deepseek-chat',
      jsonMode: params.jsonMode ?? true,
      maxTokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.1,
      attempts: 0,
      maxAttempts: 2,
      progressStep: params.type === 'expand_node' ? 'waiting_for_retrieval' : 'building_context',
      progressMessage: params.type === 'expand_node' ? '正在等待可验证论文检索结果...' : '正在准备论文上下文...',
      createdAt: now()
    }

    await paperMemoryRepository.saveLLMJob(job)
    return job
  }

  async enqueueJob(params: Parameters<LLMTaskOrchestrator['createJob']>[0]): Promise<LLMJob> {
    const job = await this.createJob(params)
    if (!this.queue.includes(job.id) && job.status !== 'cache_hit') this.queue.push(job.id)
    void this.drainQueue()
    return job
  }

  async runJob(jobId: string): Promise<LLMJob> {
    const snapshot = await paperMemoryRepository.getSnapshot()
    const job = snapshot.llmJobs.find((item) => item.id === jobId)
    if (!job) throw new Error(`Job not found: ${jobId}`)
    if (job.status === 'cache_hit' || job.status === 'succeeded') return job

    let running = await this.markRunning(job, progressForJob(job.type))
    try {
      const result = await executeJob(running)
      const validation = validateJobOutput(running, result)
      if (!validation.ok) throw new Error(`hallucinated_paper:${validation.errors.join('; ')}`)
      running = { ...running, status: 'validating', progressStep: 'validating_schema', progressMessage: '正在校验 JSON 输出和引用论文来源...' }
      await paperMemoryRepository.saveLLMJob(running)
      return this.markSucceeded(running, result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (running.attempts < running.maxAttempts && shouldRetry(message)) {
        const retryJob = { ...running, status: 'queued' as const, progressMessage: '任务失败，正在排队重试...', errorMessage: message }
        await paperMemoryRepository.saveLLMJob(retryJob)
        this.queue.push(retryJob.id)
        void this.drainQueue()
        return retryJob
      }
      return this.markFailed(running, message)
    }
  }

  validateJobOutput(job: LLMJob, output: unknown): ReferencedPaperValidationResult {
    return validateJobOutput(job, output)
  }

  async markRunning(job: LLMJob, message = '正在调用 DeepSeek 分析...'): Promise<LLMJob> {
    const controller = new AbortController()
    this.running.set(job.id, controller)
    const next = { ...job, status: 'running' as const, progressStep: 'calling_model' as const, progressMessage: message, startedAt: now(), attempts: job.attempts + 1 }
    await paperMemoryRepository.saveLLMJob(next)
    return next
  }

  async markSucceeded(job: LLMJob, resultJson: unknown): Promise<LLMJob> {
    this.running.delete(job.id)
    const next = { ...job, status: 'succeeded' as const, progressStep: 'done' as const, progressMessage: '已保存到长期记忆。', resultJson, finishedAt: now() }
    await paperMemoryRepository.saveLLMJob(next)
    return next
  }

  async markFailed(job: LLMJob, errorMessage: string): Promise<LLMJob> {
    this.running.delete(job.id)
    const next = { ...job, status: 'failed' as const, errorCode: inferErrorCode(errorMessage), errorMessage, finishedAt: now() }
    await paperMemoryRepository.saveLLMJob(next)
    return next
  }

  async cancel(jobId: string): Promise<void> {
    this.running.get(jobId)?.abort()
    this.running.delete(jobId)
    const snapshot = await paperMemoryRepository.getSnapshot()
    const job = snapshot.llmJobs.find((item) => item.id === jobId)
    if (job) {
      await paperMemoryRepository.saveLLMJob({ ...job, status: 'cancelled', errorCode: 'cancelled_by_user', finishedAt: now() })
    }
  }

  private async drainQueue(): Promise<void> {
    if (this.activeCount >= this.maxConcurrent) return
    const nextId = this.queue.shift()
    if (!nextId) return
    this.activeCount += 1
    try {
      await this.runJob(nextId)
    } finally {
      this.activeCount -= 1
      void this.drainQueue()
    }
  }
}

async function executeJob(job: LLMJob): Promise<unknown> {
  if (job.maxTokens === 0) return job.resultJson ?? { ok: true }
  const res = await callLlm({
    messages: [
      { role: 'system', content: systemPromptForJob(job.type) },
      { role: 'user', content: JSON.stringify({ type: job.type, paperId: job.paperId, nodeId: job.nodeId, relatedPaperIds: job.relatedPaperIds, input: job.inputJson }) }
    ],
    maxTokens: job.maxTokens,
    temperature: job.temperature,
    jsonMode: job.jsonMode,
    timeoutMs: 120000
  })
  return parseJsonObject(res.content)
}

function parseJsonObject(text: string): unknown {
  if (!text.trim()) throw new Error('empty_output')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('invalid_json')
  return JSON.parse(match[0])
}

export function validateReferencedPapers(output: unknown, allowedPaperIds: string[]): ReferencedPaperValidationResult {
  const allowed = new Set(allowedPaperIds)
  const referencedIds = new Set<string>()
  const suspiciousTitles: string[] = []

  function visit(value: unknown, key = ''): void {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key))
      return
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) visit(childValue, childKey)
      return
    }
    if (typeof value !== 'string') return
    if (/paperid|paper_id|relatedpaperid|relatedPaperId/i.test(key)) referencedIds.add(value)
    if (/title/i.test(key) && value.trim()) suspiciousTitles.push(value)
  }

  visit(output)
  const hallucinatedIds = [...referencedIds].filter((id) => !allowed.has(id))
  const errors = hallucinatedIds.map((id) => `输出引用了候选列表外的论文 ID: ${id}`)

  return { ok: errors.length === 0, hallucinatedIds, hallucinatedTitles: suspiciousTitles, errors }
}

export function validateJobOutput(job: LLMJob, output: unknown): ReferencedPaperValidationResult {
  if (['expand_node', 'compare_papers', 'generate_transfer_task', 'diagnose_answer'].includes(job.type) || KG4_JOB_TYPES.has(job.type)) {
    return validateReferencedPapers(output, job.relatedPaperIds)
  }
  return { ok: true, hallucinatedIds: [], hallucinatedTitles: [], errors: [] }
}

function systemPromptForJob(type: LLMJobType): string {
  if (KG4_JOB_TYPES.has(type)) {
    return [
      'You are a KG4 task worker. Return strict JSON only.',
      'Only use currentPaper, currentNode, retrievedPapers, paperAnalyses, selectedIdeaCards, comparisonRows, and userReflection from input.',
      'Never invent paper titles, authors, years, venues, experiment results, citations, URLs, or external IDs.',
      'Every paperId in output must exist in currentPaper or retrievedPapers/selectedIdeaCards supplied by input.',
      'If information is insufficient, return insufficient_information and explain missing fields.'
    ].join(' ')
  }
  return 'You are a KG3 task worker. Return strict json only. Never invent papers. Only use IDs listed by the job input.'
}

function progressForJob(type: LLMJobType): string {
  if (type === 'expand_node_retrieve_context') return '正在检索本地论文库和外部 provider...'
  if (type === 'extract_algorithm_ideas') return '正在抽取算法思想卡...'
  if (type === 'build_field_cognition_map') return '正在生成领域认知视图...'
  if (type === 'generate_expansion_graph') return '正在生成临时扩展子图...'
  if (type === 'compare_algorithm_ideas') return '正在比较 2-3 个算法思想...'
  if (type === 'generate_reflective_feedback') return '正在生成研究导师式反馈...'
  if (type === 'generate_remedial_lesson') return '正在生成前置知识补齐讲解...'
  if (type === 'suggest_graph_fusion') return '正在生成用户确认式图谱融合建议...'
  if (type === 'generate_optional_transfer_task') return '正在生成可选迁移任务...'
  if (type === 'generate_node_detail') return '正在分析该节点在论文中的作用...'
  if (type === 'expand_node') return '正在生成方向地图和方法谱系...'
  if (type === 'compare_papers') return '正在构造对比阅读表...'
  if (type === 'generate_transfer_task') return '正在生成迁移任务...'
  if (type === 'diagnose_answer') return '正在诊断你的回答...'
  if (type === 'fuse_graph_nodes') return '正在融合长期领域图谱节点...'
  return '正在调用 DeepSeek 分析...'
}

function shouldRetry(message: string): boolean {
  return /rate|429|timeout|empty|invalid_json|NETWORK_ERROR/i.test(message)
}

function inferErrorCode(message: string): LLMJob['errorCode'] {
  if (/NO_API_KEY|no api/i.test(message)) return 'no_api_key'
  if (/429|rate/i.test(message)) return 'rate_limited'
  if (/timeout|超时/i.test(message)) return 'timeout'
  if (/empty/i.test(message)) return 'empty_output'
  if (/json/i.test(message)) return 'invalid_json'
  if (/hallucinated/i.test(message)) return 'hallucinated_paper'
  if (/insufficient/i.test(message)) return 'insufficient_retrieval_data'
  return 'unknown'
}

export const llmTaskOrchestrator = new LLMTaskOrchestrator()
