import { createHash } from 'crypto'
import type { LLMJob, LLMJobType, ReferencedPaperValidationResult } from '../../shared/kg3'
import { callLlm } from './client'
import { paperMemoryRepository } from '../memory/kg3Repository'
import { isKg4JobType, systemPromptForJob } from './jobPrompts'
import type { LLMModel } from './types'

const PROMPT_VERSION = 'kg4-lineage-2026-05-31'
const EXPANSION_INTENT_KINDS = ['algorithm_method_lineage', 'generic_related_papers'] as const
const EXPANSION_PRIMARY_TYPES = ['field', 'problem', 'concept', 'method', 'paper', 'unknown'] as const
const EXPANSION_PATHS = ['learn_concept', 'track_method_lineage', 'explore_research_area', 'review_related_papers', 'inspect_paper_evidence'] as const
const PAPER_METHOD_RELATION_HINTS = ['foundation', 'parallel_variant', 'extends', 'improves_limitation', 'application_variant', 'unclear'] as const
const METHOD_LINEAGE_NODE_ROLES = ['current_method', 'foundation_method', 'parallel_variant', 'improvement', 'application_variant', 'open_problem'] as const
const METHOD_LINEAGE_RELATIONS = ['extends', 'contrasts_with', 'solves_limitation_of', 'shares_assumption_with', 'applies_to_new_context', 'evidence_insufficient'] as const
const METHOD_LINEAGE_COMPLETENESS = ['complete', 'partial', 'insufficient'] as const

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
    model?: LLMModel
  }): Promise<LLMJob> {
    const inputHash = hashInput(params.input)
    const model = params.model ?? 'deepseek-v4-pro'
    const cacheKey = [params.type, PROMPT_VERSION, model, inputHash, params.nodeId, params.paperId, ...(params.relatedPaperIds ?? [])]
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
      model,
      jsonMode: params.jsonMode ?? true,
      maxTokens: params.maxTokens ?? 16000,
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
      const result = normalizeJobOutput(running, await executeJob(running))
      const validation = validateJobOutput(running, result)
      if (!validation.ok) {
        const errorCode = validation.hallucinatedIds.length || validation.hallucinatedTitles.length ? 'hallucinated_paper' : 'schema_validation_failed'
        throw new Error(`${errorCode}:${validation.errors.join('; ')}`)
      }
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
    model: job.model,
    timeoutMs: timeoutMsForJob(job.type)
  })
  if (res.finishReason === 'length') {
    console.error('[LLM job JSON truncated before parse]', { jobId: job.id, type: job.type })
    console.error('[LLM job JSON truncated content]\n' + res.content)
    throw new Error('invalid_json:DeepSeek 输出因达到 max_tokens 被截断，JSON 不完整')
  }
  return parseJsonObject(res.content)
}

export function timeoutMsForJob(type: LLMJobType): number {
  return type === 'synthesize_method_lineage' ? 240000 : 120000
}

function parseJsonObject(text: string): unknown {
  if (!text.trim()) throw new Error('empty_output')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('invalid_json')
  try {
    return JSON.parse(match[0])
  } catch (err) {
    console.error('[LLM job JSON parse failed]', err)
    console.error('[LLM job JSON parse failed content]\n' + text)
    throw err
  }
}

export function validateReferencedPapers(output: unknown, allowedPaperIds: string[]): ReferencedPaperValidationResult {
  const allowed = new Set(allowedPaperIds)
  const allowedCanonical = buildPaperIdCanonicalMap(allowedPaperIds)
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
  const hallucinatedIds = [...referencedIds].filter((id) => !allowed.has(id) && !allowedCanonical.has(canonicalPaperIdKey(id)))
  const errors = hallucinatedIds.map((id) => `输出引用了候选列表外的论文 ID: ${id}`)

  return { ok: errors.length === 0, hallucinatedIds, hallucinatedTitles: suspiciousTitles, errors }
}

function buildPaperIdCanonicalMap(allowedPaperIds: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const paperId of allowedPaperIds) map.set(canonicalPaperIdKey(paperId), paperId)
  return map
}

function canonicalPaperIdKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//, 'doi:')
    .replace(/^doi:\s*(?:https?:\/\/)?(?:dx\.)?doi\.org\//, 'doi:')
    .replace(/^doi:\s*https?\s+doi\s+org\s+/, 'doi:')
    .replace(/^arxiv:\s*/, 'arxiv:')
    .replace(/v\d+$/i, '')
  const arxivMatch = normalized.match(/(?:arxiv|abs)\s*[:./ ]\s*(\d{4})[.\s-]?(\d{4,5})/)
  if (arxivMatch) return `arxiv ${arxivMatch[1]} ${arxivMatch[2]}`
  const doiMatch = normalized.match(/^(?:doi:\s*)?(10[.\s][a-z0-9][a-z0-9.\s/_:-]+)$/i)
  if (doiMatch) return `doi ${doiMatch[1].replace(/[^a-z0-9]+/g, ' ').trim()}`
  return normalized
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isCurrentPaperAlias(value: string): boolean {
  return /^(current[_\s-]*(pdf|paper)|paper[_\s-]*source|source[_\s-]*pdf)$/i.test(value.trim())
}

function canonicalSuppliedPaperId(value: string, allowedPaperIds: string[], currentPaperId?: string, aliasMap?: Map<string, string>): string {
  if (currentPaperId && isCurrentPaperAlias(value)) return currentPaperId
  const aliasPaperId = aliasMap?.get(canonicalPaperIdKey(value))
  if (aliasPaperId) return aliasPaperId
  return buildPaperIdCanonicalMap(allowedPaperIds).get(canonicalPaperIdKey(value)) ?? value
}

export function validateJobOutput(job: LLMJob, output: unknown): ReferencedPaperValidationResult {
  const allowedPaperIds = [...job.relatedPaperIds, ...(job.paperId ? [job.paperId] : [])]
  if (job.type === 'classify_expansion_intent') {
    return validateExpansionIntent(output)
  }
  if (job.type === 'digest_paper_method') {
    const outputForValidation = normalizePaperMethodDigestOutput(output, allowedPaperIds)
    return mergeValidationResults(
      validateReferencedPapers(outputForValidation, allowedPaperIds),
      validatePaperMethodDigest(outputForValidation, allowedPaperIds, expectedRetrievedPaperTitle(job.inputJson))
    )
  }
  if (job.type === 'teach_concept') {
    return mergeValidationResults(
      validateReferencedPapers(output, allowedPaperIds),
      validateConceptLearning(output)
    )
  }
  if (job.type === 'map_research_area') {
    return mergeValidationResults(
      validateReferencedPapers(output, allowedPaperIds),
      validateResearchArea(output)
    )
  }
  if (job.type === 'synthesize_method_lineage') {
    const normalizedLineage = hasPdfGroundingInput(job.inputJson)
      ? normalizePdfGroundedMethodLineageOutput(output)
      : output
    const outputForValidation = normalizeMethodLineagePaperIds(normalizedLineage, allowedPaperIds, job.paperId, paperAliasMap(job.inputJson))
    return mergeValidationResults(
      validateReferencedPapers(outputForValidation, allowedPaperIds),
      validateMethodLineageView(
        outputForValidation,
        allowedPaperIds,
        allowedDigestIds(job.inputJson),
        { requirePdfGrounding: hasPdfGroundingInput(job.inputJson) }
      )
    )
  }
  if (['expand_node', 'compare_papers', 'generate_transfer_task', 'diagnose_answer'].includes(job.type) || isKg4JobType(job.type)) {
    return validateReferencedPapers(output, allowedPaperIds)
  }
  return { ok: true, hallucinatedIds: [], hallucinatedTitles: [], errors: [] }
}

function normalizeJobOutput(job: LLMJob, output: unknown): unknown {
  const allowedPaperIds = [...job.relatedPaperIds, ...(job.paperId ? [job.paperId] : [])]
  if (job.type === 'digest_paper_method') {
    return normalizePaperMethodDigestOutput(output, allowedPaperIds)
  }
  if (job.type === 'synthesize_method_lineage') {
    const lineage = hasPdfGroundingInput(job.inputJson) ? normalizePdfGroundedMethodLineageOutput(output) : output
    return normalizeMethodLineagePaperIds(lineage, allowedPaperIds, job.paperId, paperAliasMap(job.inputJson))
  }
  return output
}

function validateExpansionIntent(output: unknown): ReferencedPaperValidationResult {
  const errors: string[] = []
  if (!isRecord(output)) return schemaErrors('classify_expansion_intent output must be an object')

  // Legacy output shape
  if (output.kind !== undefined) {
    if (!isOneOf(output.kind, EXPANSION_INTENT_KINDS)) errors.push('classify_expansion_intent.kind must be algorithm_method_lineage or generic_related_papers')
    if (!isNumberInRange(output.confidence, 0, 1)) errors.push('classify_expansion_intent.confidence must be a number between 0 and 1')
    if (!isNonEmptyString(output.queryFocus)) errors.push('classify_expansion_intent.queryFocus must be a non-empty string')
    if (!isNonEmptyString(output.rationale)) errors.push('classify_expansion_intent.rationale must be a non-empty string')
    if (output.fallbackReason !== undefined && output.fallbackReason !== null && typeof output.fallbackReason !== 'string') errors.push('classify_expansion_intent.fallbackReason must be a string when present')
    return schemaErrors(...errors)
  }

  // New strategy classification shape
  if (!isOneOf(output.primaryType, EXPANSION_PRIMARY_TYPES)) errors.push('classify_expansion_intent.primaryType must be a supported primary type')
  if (!Array.isArray(output.facets) || !output.facets.every((facet: unknown) => typeof facet === 'string')) errors.push('classify_expansion_intent.facets must be a string array')
  if (!isNumberInRange(output.confidence, 0, 1)) errors.push('classify_expansion_intent.confidence must be a number between 0 and 1')
  if (!isNonEmptyString(output.rationale)) errors.push('classify_expansion_intent.rationale must be a non-empty string')
  if (!isOneOf(output.recommendedPath, EXPANSION_PATHS)) errors.push('classify_expansion_intent.recommendedPath must be a supported path')
  if (!Array.isArray(output.alternativePaths) || !output.alternativePaths.every((path: unknown) => isOneOf(path, EXPANSION_PATHS))) errors.push('classify_expansion_intent.alternativePaths must be supported paths')
  if (output.ambiguity !== undefined && output.ambiguity !== null) {
    if (!isRecord(output.ambiguity)) {
      errors.push('classify_expansion_intent.ambiguity must be an object when present')
    } else {
      if (!isOneOf(output.ambiguity.competingType, EXPANSION_PRIMARY_TYPES)) errors.push('classify_expansion_intent.ambiguity.competingType must be a supported primary type')
      if (!isNonEmptyString(output.ambiguity.reason)) errors.push('classify_expansion_intent.ambiguity.reason must be a non-empty string')
    }
  }
  return schemaErrors(...errors)
}

function validatePaperMethodDigest(output: unknown, allowedPaperIds: string[], expectedTitle?: string): ReferencedPaperValidationResult {
  const errors: string[] = []
  if (!isRecord(output)) return schemaErrors('digest_paper_method output must be an object')
  if (!isNonEmptyString(output.id)) errors.push('digest_paper_method.id must be a non-empty string')
  if (!isNonEmptyString(output.paperId)) {
    errors.push('digest_paper_method.paperId must be a non-empty string')
  } else if (!allowedPaperIds.includes(output.paperId)) {
    errors.push(`digest_paper_method.paperId must reference a supplied paper: ${output.paperId}`)
  }
  if (!isNonEmptyString(output.paperTitle)) {
    errors.push('digest_paper_method.paperTitle must be a non-empty string')
  } else if (expectedTitle && output.paperTitle !== expectedTitle) {
    errors.push(`digest_paper_method.paperTitle must match supplied retrievedPaper.title: ${expectedTitle}`)
  }
  if (!isNonEmptyString(output.problemSetting)) errors.push('digest_paper_method.problemSetting must be a non-empty string')
  if (!isNonEmptyString(output.coreMechanism)) errors.push('digest_paper_method.coreMechanism must be a non-empty string')
  if (!isNonEmptyString(output.evidenceSummary)) errors.push('digest_paper_method.evidenceSummary must be a non-empty string')
  if (output.methodName !== undefined && typeof output.methodName !== 'string') errors.push('digest_paper_method.methodName must be a string when present')
  if (output.claimedImprovement !== undefined && typeof output.claimedImprovement !== 'string') errors.push('digest_paper_method.claimedImprovement must be a string when present')
  if (output.limitation !== undefined && typeof output.limitation !== 'string') errors.push('digest_paper_method.limitation must be a string when present')
  if (output.insufficientInformation !== undefined && typeof output.insufficientInformation !== 'string') errors.push('digest_paper_method.insufficientInformation must be a string when present')
  const relationHints = Array.isArray(output.relationHints) ? output.relationHints : [output.relationHints]
  if (!relationHints.some((hint) => isOneOf(hint, PAPER_METHOD_RELATION_HINTS))) {
    errors.push('digest_paper_method.relationHints must be an array of allowed hints')
  }
  if (!isNumberInRange(normalizeConfidence(output.confidence), 0, 1)) errors.push('digest_paper_method.confidence must be a number between 0 and 1')
  return schemaErrors(...errors)
}

function normalizePaperMethodDigestOutput(output: unknown, allowedPaperIds: string[]): unknown {
  if (!isRecord(output)) return output
  const normalized: Record<string, unknown> = { ...output }
  if (typeof normalized.paperId === 'string') normalized.paperId = canonicalSuppliedPaperId(normalized.paperId, allowedPaperIds)
  return normalized
}

function normalizeConfidence(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (/高|high/.test(normalized)) return 0.85
  if (/中|medium|moderate/.test(normalized)) return 0.6
  if (/低|low/.test(normalized)) return 0.35
  if (normalized === 'high') return 0.85
  if (normalized === 'medium') return 0.6
  if (normalized === 'low') return 0.35
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizePdfGroundedMethodLineageOutput(output: unknown): unknown {
  if (!isRecord(output)) return output
  const normalized: Record<string, unknown> = { ...output }
  normalized.openQuestions = stringArrayFrom(normalized.openQuestions)
  normalized.readingOrder = stringArrayFrom(normalized.readingOrder)
  normalized.missingDataReasons = stringArrayFrom(normalized.missingDataReasons)
  normalized.dataCompleteness = normalizeCompleteness(normalized.dataCompleteness)
  normalized.problemSetup = normalizeProblemSetup(normalized.problemSetup)
  normalized.anchorPosition = normalizeAnchorPosition(normalized.anchorPosition)
  normalized.conceptBridge = normalizeConceptBridge(normalized.conceptBridge)
  normalized.methodComparisons = normalizeMethodComparisons(normalized.methodComparisons)
  normalized.nodes = normalizeLineageNodes(normalized.nodes)
  normalized.edges = normalizeLineageEdges(normalized.edges)
  return normalized
}

function normalizeMethodLineagePaperIds(output: unknown, allowedPaperIds: string[], currentPaperId?: string, aliasMap?: Map<string, string>): unknown {
  if (!isRecord(output)) return output
  const normalizeIds = (value: unknown): string[] => stringArrayFrom(value).map((paperId) => canonicalSuppliedPaperId(paperId, allowedPaperIds, currentPaperId, aliasMap))
  const nodes = Array.isArray(output.nodes)
    ? output.nodes.map((node) => isRecord(node)
      ? { ...node, representativePaperIds: normalizeIds(node.representativePaperIds) }
      : node)
    : output.nodes
  return {
    ...output,
    readingOrder: normalizeReadingOrder(output.readingOrder, nodes, normalizeIds),
    nodes,
    edges: Array.isArray(output.edges)
      ? output.edges.map((edge) => isRecord(edge)
        ? { ...edge, evidencePaperIds: normalizeIds(edge.evidencePaperIds) }
        : edge)
      : output.edges
  }
}

function normalizeReadingOrder(
  value: unknown,
  nodes: unknown,
  normalizeIds: (value: unknown) => string[]
): string[] {
  const rawItems = stringArrayFrom(value)
  const directPaperIds = normalizeIds(rawItems).filter((paperId) => isKnownPaperId(paperId))
  if (directPaperIds.length) return [...new Set(directPaperIds)]
  if (!Array.isArray(nodes)) return []
  const nodeById = new Map<string, Record<string, unknown>>()
  nodes.forEach((node) => {
    if (isRecord(node) && typeof node.id === 'string' && node.id.trim()) {
      nodeById.set(node.id, node)
    }
  })
  const fromNodeOrder = rawItems.flatMap((item) => {
    const node = nodeById.get(item)
    return node ? stringArrayFrom(node.representativePaperIds).filter((paperId) => isKnownPaperId(paperId)) : []
  })
  return [...new Set(fromNodeOrder)]
}

function normalizeCompleteness(value: unknown): 'complete' | 'partial' | 'insufficient' {
  if (value === 'complete' || value === 'partial' || value === 'insufficient') return value
  if (typeof value !== 'string') return 'partial'
  const normalized = value.trim().toLowerCase()
  if (/partial|部分/.test(normalized)) return 'partial'
  if (/insufficient|不足|不完整|缺/.test(normalized)) return 'insufficient'
  if (/complete|完整/.test(normalized)) return 'complete'
  return 'partial'
}

function stringArrayFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function nonEmptyStringFrom(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function normalizePdfEvidenceArray(value: unknown, fallbackClaim: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const excerpt = nonEmptyStringFrom(item.excerpt)
    if (!excerpt) return []
    return [{
      ...item,
      sourceType: 'current_pdf',
      excerpt,
      claimSupported: nonEmptyStringFrom(item.claimSupported, fallbackClaim) ?? fallbackClaim
    }]
  })
}

function normalizeEvidenceArray(value: unknown, fallbackClaim: string): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined
  const evidence: Record<string, unknown>[] = []
  value.forEach((item) => {
    if (!isRecord(item)) return
    if (item.sourceType === 'model_knowledge') {
      evidence.push({
        ...item,
        note: nonEmptyStringFrom(item.note, item.claimSupported, item.excerpt, fallbackClaim) ?? fallbackClaim,
        confidence: normalizeConfidence(item.confidence) ?? 0.6
      })
      return
    }
    if (item.sourceType === 'future_retrieval_needed') {
      evidence.push({ ...item, reason: nonEmptyStringFrom(item.reason, fallbackClaim) ?? fallbackClaim })
      return
    }
    const excerpt = nonEmptyStringFrom(item.excerpt)
    if (!excerpt) return
    evidence.push({
      ...item,
      sourceType: 'current_pdf',
      excerpt,
      claimSupported: nonEmptyStringFrom(item.claimSupported, fallbackClaim) ?? fallbackClaim
    })
  })
  return evidence.length ? evidence : undefined
}

function normalizeProblemSetup(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    const beginnerExplanation = nonEmptyStringFrom(value.beginnerExplanation, value.explanation, value.summary, value.problem) ?? '当前论文围绕一个需要从原文中进一步解释的研究问题展开。'
    const whyThisProblemMatters = nonEmptyStringFrom(value.whyThisProblemMatters, value.whyItMatters, value.motivation, value.summary) ?? beginnerExplanation
    return {
      ...value,
      beginnerExplanation,
      whyThisProblemMatters,
      pdfEvidence: normalizePdfEvidenceArray(value.pdfEvidence ?? value.evidence, beginnerExplanation)
    }
  }
  const text = nonEmptyStringFrom(value) ?? '当前论文围绕一个需要从原文中进一步解释的研究问题展开。'
  return { beginnerExplanation: text, whyThisProblemMatters: text, pdfEvidence: [] }
}

function normalizeAnchorPosition(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    const summary = nonEmptyStringFrom(value.summary, value.explanation, value.position) ?? '当前论文方法处在该谱系中的当前位置需要结合原文理解。'
    const whatTheCurrentPaperChanges = nonEmptyStringFrom(value.whatTheCurrentPaperChanges, value.change, value.contribution, value.summary) ?? summary
    return {
      ...value,
      summary,
      whatTheCurrentPaperChanges,
      whatItInherits: stringArrayFrom(value.whatItInherits),
      whatItDoesNotSolve: stringArrayFrom(value.whatItDoesNotSolve),
      pdfEvidence: normalizePdfEvidenceArray(value.pdfEvidence ?? value.evidence, summary)
    }
  }
  const text = nonEmptyStringFrom(value) ?? '当前论文方法处在该谱系中的当前位置需要结合原文理解。'
  return {
    summary: text,
    whatTheCurrentPaperChanges: text,
    whatItInherits: [],
    whatItDoesNotSolve: [],
    pdfEvidence: []
  }
}

function normalizeConceptBridge(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item)) return []
      const concept = nonEmptyStringFrom(item.concept, item.label, item.title) ?? '谱系背景概念'
      const explanation = nonEmptyStringFrom(item.explanation, item.summary, item.description) ?? concept
      const whyNeededForThisLineage = nonEmptyStringFrom(item.whyNeededForThisLineage, item.whyNeeded, item.relevance, item.explanation) ?? explanation
      return [{
        ...item,
        concept,
        explanation,
        whyNeededForThisLineage,
        pdfEvidence: normalizePdfEvidenceArray(item.pdfEvidence, explanation)
      }]
    })
  }
  const explanation = nonEmptyStringFrom(value)
  return explanation
    ? [{ concept: '谱系背景概念', explanation, whyNeededForThisLineage: explanation }]
    : undefined
}

function normalizeMethodComparisons(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const methodA = nonEmptyStringFrom(item.methodA, item.sourceMethod)
    const methodB = nonEmptyStringFrom(item.methodB, item.targetMethod)
    const keyDifference = nonEmptyStringFrom(item.keyDifference, item.comparison, item.difference, item.summary)
    if (!methodA || !methodB || !keyDifference) return []
    const whyItMatters = nonEmptyStringFrom(item.whyItMatters, item.importance, item.comparison, item.summary) ?? keyDifference
    return [{
      ...item,
      methodA,
      methodB,
      keyDifference,
      whyItMatters,
      evidence: normalizeEvidenceArray(item.evidence, keyDifference) ?? []
    }]
  })
}

function normalizeLineageNodes(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((node) => {
    if (!isRecord(node)) return node
    const summary = nonEmptyStringFrom(node.summary, node.explanation, node.description) ?? ''
    const next: Record<string, unknown> = {
      ...node,
      summary,
      representativePaperIds: stringArrayFrom(node.representativePaperIds),
      digestIds: stringArrayFrom(node.digestIds)
    }
    const evidence = normalizeEvidenceArray(node.evidence, summary)
    if (evidence) next.evidence = evidence
    return next
  })
}

function normalizeLineageEdges(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((edge) => {
    if (!isRecord(edge)) return edge
    const explanation = nonEmptyStringFrom(edge.explanation, edge.summary, edge.description) ?? ''
    const next: Record<string, unknown> = {
      ...edge,
      relation: normalizeLineageRelation(edge.relation),
      explanation,
      evidencePaperIds: stringArrayFrom(edge.evidencePaperIds),
      confidence: normalizeConfidence(edge.confidence) ?? 0.5
    }
    const evidence = normalizeEvidenceArray(edge.evidence, explanation)
    if (evidence) next.evidence = evidence
    return next
  })
}

function normalizeLineageRelation(value: unknown): unknown {
  if (value === 'foundation_method' || value === 'extends' || value === 'improvement') return 'extends'
  if (value === 'parallel_variant') return 'contrasts_with'
  if (value === 'application_variant') return 'applies_to_new_context'
  if (value === 'open_problem') return 'evidence_insufficient'
  return value
}

function isKnownPaperId(value: string): boolean {
  return /^(paper|local|doi|arxiv|openalex|semantic_scholar|s2)[\s:_-]/i.test(value) || /^10[\s.]/.test(value)
}

function hasPdfGroundingInput(input: unknown): boolean {
  return isRecord(input) && isRecord(input.methodLineageContext) && isRecord(input.methodLineageContext.paperSource)
}

function paperAliasMap(input: unknown): Map<string, string> {
  const map = new Map<string, string>()
  const addAlias = (alias: unknown, paperId: unknown): void => {
    if (typeof alias !== 'string' || typeof paperId !== 'string' || !alias.trim() || !paperId.trim()) return
    map.set(canonicalPaperIdKey(alias), paperId)
  }
  if (!isRecord(input)) return map
  if (Array.isArray(input.paperMethodDigests)) {
    input.paperMethodDigests.forEach((digest) => {
      if (!isRecord(digest) || typeof digest.paperId !== 'string') return
      addAlias(digest.id, digest.paperId)
      addAlias(digest.paperTitle, digest.paperId)
      addAlias(digest.methodName, digest.paperId)
      addAlias(digest.paperId, digest.paperId)
    })
  }
  if (Array.isArray(input.retrievedPapers)) {
    input.retrievedPapers.forEach((paper) => {
      if (!isRecord(paper) || typeof paper.id !== 'string') return
      addAlias(paper.id, paper.id)
      addAlias(paper.title, paper.id)
    })
  }
  return map
}

function validatePdfEvidenceRef(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`)
    return
  }
  if (value.sourceType !== 'current_pdf') errors.push(`${path}.sourceType must be current_pdf`)
  if (!isNonEmptyString(value.excerpt)) errors.push(`${path}.excerpt must be a non-empty string`)
  if (!isNonEmptyString(value.claimSupported)) errors.push(`${path}.claimSupported must be a non-empty string`)
  if (value.pageNumber !== undefined && (!(typeof value.pageNumber === 'number') || !Number.isInteger(value.pageNumber) || value.pageNumber <= 0)) {
    errors.push(`${path}.pageNumber must be a positive integer when present`)
  }
  if (value.sectionTitle !== undefined && typeof value.sectionTitle !== 'string') errors.push(`${path}.sectionTitle must be a string when present`)
}

function validateEvidenceRef(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`)
    return
  }
  if (value.sourceType === 'current_pdf') {
    validatePdfEvidenceRef(value, path, errors)
    return
  }
  if (value.sourceType === 'model_knowledge') {
    if (!isNonEmptyString(value.note)) errors.push(`${path}.note must be a non-empty string`)
    if (!isNumberInRange(value.confidence, 0, 1)) errors.push(`${path}.confidence must be a number between 0 and 1`)
    return
  }
  if (value.sourceType === 'future_retrieval_needed') {
    if (!isNonEmptyString(value.reason)) errors.push(`${path}.reason must be a non-empty string`)
    return
  }
  errors.push(`${path}.sourceType must be current_pdf, model_knowledge, or future_retrieval_needed`)
}

function validateEvidenceArray(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`)
    return
  }
  value.forEach((item, index) => validateEvidenceRef(item, `${path}[${index}]`, errors))
}

function validateMethodLineageView(output: unknown, allowedPaperIds: string[], allowedDigestIdsSet: Set<string>, options: { requirePdfGrounding?: boolean } = {}): ReferencedPaperValidationResult {
  const errors: string[] = []
  if (!isRecord(output)) return schemaErrors('synthesize_method_lineage output must be an object')
  if (!isNonEmptyString(output.id)) errors.push('synthesize_method_lineage.id must be a non-empty string')
  if (!isNonEmptyString(output.anchorNodeId)) errors.push('synthesize_method_lineage.anchorNodeId must be a non-empty string')
  if (!isNonEmptyString(output.title)) errors.push('synthesize_method_lineage.title must be a non-empty string')
  if (!isNonEmptyString(output.summary)) errors.push('synthesize_method_lineage.summary must be a non-empty string')
  const nodeIds = new Set<string>()
  if (!Array.isArray(output.nodes)) {
    errors.push('synthesize_method_lineage.nodes must be an array')
  } else {
    output.nodes.forEach((node, index) => validateMethodLineageNode(node, index, allowedPaperIds, allowedDigestIdsSet, nodeIds, errors))
  }
  if (!Array.isArray(output.edges)) {
    errors.push('synthesize_method_lineage.edges must be an array')
  } else {
    output.edges.forEach((edge, index) => validateMethodLineageEdge(edge, index, allowedPaperIds, nodeIds, errors))
  }
  if (!isStringArray(output.openQuestions)) errors.push('synthesize_method_lineage.openQuestions must be a string array')
  if (!isStringArray(output.readingOrder)) {
    errors.push('synthesize_method_lineage.readingOrder must be a string array')
  } else {
    const unknownReadingOrderIds = output.readingOrder.filter((paperId) => !allowedPaperIds.includes(paperId))
    if (unknownReadingOrderIds.length) {
      errors.push(`synthesize_method_lineage.readingOrder must only reference supplied papers: ${unknownReadingOrderIds.join(', ')}`)
    }
  }
  if (!isOneOf(output.dataCompleteness, METHOD_LINEAGE_COMPLETENESS)) errors.push('synthesize_method_lineage.dataCompleteness must be complete, partial, or insufficient')
  if (!isStringArray(output.missingDataReasons)) errors.push('synthesize_method_lineage.missingDataReasons must be a string array')

  if (options.requirePdfGrounding) {
    const problemSetup = isRecord(output) ? output.problemSetup : undefined
    if (!isRecord(problemSetup)) {
      errors.push('synthesize_method_lineage.problemSetup must be an object for PDF-grounded lineage')
    } else {
      if (!isNonEmptyString(problemSetup.beginnerExplanation)) errors.push('synthesize_method_lineage.problemSetup.beginnerExplanation must be a non-empty string')
      if (!isNonEmptyString(problemSetup.whyThisProblemMatters)) errors.push('synthesize_method_lineage.problemSetup.whyThisProblemMatters must be a non-empty string')
      if (!Array.isArray(problemSetup.pdfEvidence)) errors.push('synthesize_method_lineage.problemSetup.pdfEvidence must be an array')
      ;(Array.isArray(problemSetup.pdfEvidence) ? problemSetup.pdfEvidence : []).forEach((item, index) => validatePdfEvidenceRef(item, `synthesize_method_lineage.problemSetup.pdfEvidence[${index}]`, errors))
    }

    const anchorPosition = isRecord(output) ? output.anchorPosition : undefined
    if (!isRecord(anchorPosition)) {
      errors.push('synthesize_method_lineage.anchorPosition must be an object for PDF-grounded lineage')
    } else {
      if (!isNonEmptyString(anchorPosition.summary)) errors.push('synthesize_method_lineage.anchorPosition.summary must be a non-empty string')
      if (!isNonEmptyString(anchorPosition.whatTheCurrentPaperChanges)) errors.push('synthesize_method_lineage.anchorPosition.whatTheCurrentPaperChanges must be a non-empty string')
      if (!isStringArray(anchorPosition.whatItInherits)) errors.push('synthesize_method_lineage.anchorPosition.whatItInherits must be a string array')
      if (!isStringArray(anchorPosition.whatItDoesNotSolve)) errors.push('synthesize_method_lineage.anchorPosition.whatItDoesNotSolve must be a string array')
      if (!Array.isArray(anchorPosition.pdfEvidence)) errors.push('synthesize_method_lineage.anchorPosition.pdfEvidence must be an array')
      ;(Array.isArray(anchorPosition.pdfEvidence) ? anchorPosition.pdfEvidence : []).forEach((item, index) => validatePdfEvidenceRef(item, `synthesize_method_lineage.anchorPosition.pdfEvidence[${index}]`, errors))
    }
  }

  const methodComparisons = isRecord(output) ? output.methodComparisons : undefined
  if (methodComparisons !== undefined) {
    if (!Array.isArray(methodComparisons)) errors.push('synthesize_method_lineage.methodComparisons must be an array')
    ;(Array.isArray(methodComparisons) ? methodComparisons : []).forEach((comparison, index) => {
      if (!isRecord(comparison)) {
        errors.push(`synthesize_method_lineage.methodComparisons[${index}] must be an object`)
        return
      }
      if (!isNonEmptyString(comparison.methodA)) errors.push(`synthesize_method_lineage.methodComparisons[${index}].methodA must be a non-empty string`)
      if (!isNonEmptyString(comparison.methodB)) errors.push(`synthesize_method_lineage.methodComparisons[${index}].methodB must be a non-empty string`)
      if (!isNonEmptyString(comparison.keyDifference)) errors.push(`synthesize_method_lineage.methodComparisons[${index}].keyDifference must be a non-empty string`)
      if (!isNonEmptyString(comparison.whyItMatters)) errors.push(`synthesize_method_lineage.methodComparisons[${index}].whyItMatters must be a non-empty string`)
      validateEvidenceArray(comparison.evidence, `synthesize_method_lineage.methodComparisons[${index}].evidence`, errors)
    })
  }

  return schemaErrors(...errors)
}

function validateMethodLineageNode(node: unknown, index: number, allowedPaperIds: string[], allowedDigestIdsSet: Set<string>, nodeIds: Set<string>, errors: string[]): void {
  if (!isRecord(node)) {
    errors.push(`synthesize_method_lineage.nodes[${index}] must be an object`)
    return
  }
  if (!isNonEmptyString(node.id)) {
    errors.push(`synthesize_method_lineage.nodes[${index}].id must be a non-empty string`)
  } else {
    nodeIds.add(node.id)
  }
  if (!isNonEmptyString(node.label)) errors.push(`synthesize_method_lineage.nodes[${index}].label must be a non-empty string`)
  if (!isOneOf(node.role, METHOD_LINEAGE_NODE_ROLES)) errors.push(`synthesize_method_lineage.nodes[${index}].role must be an allowed role`)
  if (!isNonEmptyString(node.summary)) errors.push(`synthesize_method_lineage.nodes[${index}].summary must be a non-empty string`)
  if (!isStringArray(node.representativePaperIds)) {
    errors.push(`synthesize_method_lineage.nodes[${index}].representativePaperIds must be a string array`)
  } else if (node.representativePaperIds.some((paperId) => !allowedPaperIds.includes(paperId))) {
    errors.push(`synthesize_method_lineage.nodes[${index}].representativePaperIds must only reference supplied papers`)
  }
  if (!isStringArray(node.digestIds)) {
    errors.push(`synthesize_method_lineage.nodes[${index}].digestIds must be a string array`)
  } else if (node.digestIds.some((digestId) => !allowedDigestIdsSet.has(digestId))) {
    errors.push(`synthesize_method_lineage.nodes[${index}].digestIds must only reference supplied paperMethodDigests`)
  }
  if (node.evidence !== undefined) validateEvidenceArray(node.evidence, `synthesize_method_lineage.nodes[${index}].evidence`, errors)
}

function validateMethodLineageEdge(edge: unknown, index: number, allowedPaperIds: string[], nodeIds: Set<string>, errors: string[]): void {
  if (!isRecord(edge)) {
    errors.push(`synthesize_method_lineage.edges[${index}] must be an object`)
    return
  }
  if (!isNonEmptyString(edge.id)) errors.push(`synthesize_method_lineage.edges[${index}].id must be a non-empty string`)
  if (!isNonEmptyString(edge.sourceId)) {
    errors.push(`synthesize_method_lineage.edges[${index}].sourceId must be a non-empty string`)
  } else if (!nodeIds.has(edge.sourceId)) {
    errors.push(`synthesize_method_lineage.edges[${index}].sourceId must reference an output node`)
  }
  if (!isNonEmptyString(edge.targetId)) {
    errors.push(`synthesize_method_lineage.edges[${index}].targetId must be a non-empty string`)
  } else if (!nodeIds.has(edge.targetId)) {
    errors.push(`synthesize_method_lineage.edges[${index}].targetId must reference an output node`)
  }
  if (!isOneOf(edge.relation, METHOD_LINEAGE_RELATIONS)) errors.push(`synthesize_method_lineage.edges[${index}].relation must be an allowed relation`)
  if (!isNonEmptyString(edge.explanation)) errors.push(`synthesize_method_lineage.edges[${index}].explanation must be a non-empty string`)
  if (!isStringArray(edge.evidencePaperIds)) {
    errors.push(`synthesize_method_lineage.edges[${index}].evidencePaperIds must be a string array`)
  } else if (edge.evidencePaperIds.some((paperId) => !allowedPaperIds.includes(paperId))) {
    errors.push(`synthesize_method_lineage.edges[${index}].evidencePaperIds must only reference supplied papers`)
  }
  if (!isNumberInRange(edge.confidence, 0, 1)) errors.push(`synthesize_method_lineage.edges[${index}].confidence must be a number between 0 and 1`)
  if (edge.evidence !== undefined) validateEvidenceArray(edge.evidence, `synthesize_method_lineage.edges[${index}].evidence`, errors)
}

function validateResearchArea(output: unknown): ReferencedPaperValidationResult {
  const errors: string[] = []
  if (!isRecord(output)) return schemaErrors('map_research_area output must be an object')
  if (!isNonEmptyString(output.id)) errors.push('map_research_area.id must be a non-empty string')
  if (!isNonEmptyString(output.anchorNodeId)) errors.push('map_research_area.anchorNodeId must be a non-empty string')
  if (!isNonEmptyString(output.title)) errors.push('map_research_area.title must be a non-empty string')
  if (!isNonEmptyString(output.overview)) errors.push('map_research_area.overview must be a non-empty string')
  if (!Array.isArray(output.keyProblems)) errors.push('map_research_area.keyProblems must be an array')
  if (!Array.isArray(output.methodFamilies)) errors.push('map_research_area.methodFamilies must be an array')
  if (!Array.isArray(output.recommendedReading)) errors.push('map_research_area.recommendedReading must be an array')
  return schemaErrors(...errors)
}

function validateConceptLearning(output: unknown): ReferencedPaperValidationResult {
  const errors: string[] = []
  if (!isRecord(output)) return schemaErrors('teach_concept output must be an object')
  if (!isNonEmptyString(output.id)) errors.push('teach_concept.id must be a non-empty string')
  if (!isNonEmptyString(output.anchorNodeId)) errors.push('teach_concept.anchorNodeId must be a non-empty string')
  if (!isNonEmptyString(output.title)) errors.push('teach_concept.title must be a non-empty string')
  const qe = output.quickExplanation
  if (!isRecord(qe)) {
    errors.push('teach_concept.quickExplanation must be an object')
  } else {
    if (!isNonEmptyString(qe.intuition)) errors.push('teach_concept.quickExplanation.intuition must be a non-empty string')
    if (!isNonEmptyString(qe.problemSolved)) errors.push('teach_concept.quickExplanation.problemSolved must be a non-empty string')
    if (!isNonEmptyString(qe.coreMechanism)) errors.push('teach_concept.quickExplanation.coreMechanism must be a non-empty string')
    if (!isNonEmptyString(qe.whenToUse)) errors.push('teach_concept.quickExplanation.whenToUse must be a non-empty string')
  }
  const fe = output.formalExplanation
  if (!isRecord(fe)) {
    errors.push('teach_concept.formalExplanation must be an object')
  } else {
    if (!isNonEmptyString(fe.definition)) errors.push('teach_concept.formalExplanation.definition must be a non-empty string')
    if (!Array.isArray(fe.formulas)) errors.push('teach_concept.formalExplanation.formulas must be an array')
  }
  if (!Array.isArray(output.misconceptions)) errors.push('teach_concept.misconceptions must be an array')
  return schemaErrors(...errors)
}

function expectedRetrievedPaperTitle(input: unknown): string | undefined {
  if (!isRecord(input) || !isRecord(input.retrievedPaper)) return undefined
  return typeof input.retrievedPaper.title === 'string' && input.retrievedPaper.title.trim() ? input.retrievedPaper.title : undefined
}

function allowedDigestIds(input: unknown): Set<string> {
  if (!isRecord(input) || !Array.isArray(input.paperMethodDigests)) return new Set<string>()
  return new Set(
    input.paperMethodDigests
      .map((digest) => (isRecord(digest) && typeof digest.id === 'string' ? digest.id : undefined))
      .filter((id): id is string => Boolean(id))
  )
}

function mergeValidationResults(...results: ReferencedPaperValidationResult[]): ReferencedPaperValidationResult {
  const hallucinatedIds = [...new Set(results.flatMap((result) => result.hallucinatedIds))]
  const hallucinatedTitles = [...new Set(results.flatMap((result) => result.hallucinatedTitles))]
  const errors = results.flatMap((result) => result.errors)
  return { ok: errors.length === 0, hallucinatedIds, hallucinatedTitles, errors }
}

function schemaErrors(...errors: string[]): ReferencedPaperValidationResult {
  return { ok: errors.length === 0, hallucinatedIds: [], hallucinatedTitles: [], errors }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && allowed.includes(value as T[number])
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
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
  if (/schema_validation_failed/i.test(message)) return 'schema_validation_failed'
  if (/hallucinated/i.test(message)) return 'hallucinated_paper'
  if (/insufficient/i.test(message)) return 'insufficient_retrieval_data'
  return 'unknown'
}

export const llmTaskOrchestrator = new LLMTaskOrchestrator()
