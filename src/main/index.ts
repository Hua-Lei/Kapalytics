import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { aiAnalyzePaper, aiDiagnose } from './llm/generate'
import {
  callLlm,
  setApiKey,
  clearApiKey,
  hasApiKey,
  getAvailableProviders,
  getLlmConfig,
  setProvider,
  setProxyUrl,
  setSemanticScholarApiKey,
  clearSemanticScholarApiKey
} from './llm/client'
import { deepseekProvider } from './llm/providers/deepseek'
import { extractPdfContent } from './paper/extractPdfContent'
import { paperMemoryRepository } from './memory/kg3Repository'
import { fusePaperGraph } from './memory/graphFusion'
import { searchPapers } from './retrieval/paperSearch'
import { toRetrievalConnectionTestResult } from './retrieval/retrievalTest'
import { llmTaskOrchestrator } from './llm/orchestrator'
import { candidatePaperId } from './kg4/expansionRecord'
import { buildStrategyRetrievalPlan } from './kg4/expansionQuery'
import { classificationToLegacyIntent, normalizeExpansionClassification } from './kg4/expansionClassification'
import { buildRelatedPaperRecommendations, annotatePaperQuality } from './kg4/paperQuality'
import { assembleLineageExpansionRecord } from './kg4/lineageRecord'
import { KG4_EXPANSION_TOKEN_BUDGETS } from './kg4/tokenBudgets'
import { compactRetrievedPapersForLineage } from './kg4/llmInput'
import type { GraphEdge, GraphNode, PaperInsight } from '../shared/paper'
import type { LLMJob, PaperRecord } from '../shared/kg3'
import type {
  ExpansionIntent,
  Kg4ExpansionRecordQuery,
  Kg4NodeExpansionRecord,
  MethodLineageView,
  PaperMethodDigest,
  StartKg4ExpansionParams
} from '../shared/kg4'
import { isKg4NodeExpansionRecord } from '../shared/kg4'

// Linux GPU fallback — must run before app ready
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu')
  app.disableHardwareAcceleration()
}

function getStoragePath(): string {
  const dir = join(app.getPath('userData'), 'saves')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'learning-state.json')
}

function now(): string {
  return new Date().toISOString()
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 16)}`
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workerCount = Math.min(Math.max(1, limit), items.length)

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex])
    }
  }))

  return results
}

function normalizeExpansionIntent(value: unknown): ExpansionIntent {
  const fallback: ExpansionIntent = {
    kind: 'generic_related_papers',
    confidence: 0.3,
    queryFocus: 'related papers',
    rationale: '未能稳定分类展开意图，回退为通用相关论文检索。'
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback

  const record = value as Record<string, unknown>
  const confidence = typeof record.confidence === 'number' && Number.isFinite(record.confidence) ? record.confidence : fallback.confidence
  const fallbackReason = typeof record.fallbackReason === 'string' && record.fallbackReason.trim() ? record.fallbackReason.trim() : undefined
  const lowConfidenceLineage = record.kind === 'algorithm_method_lineage' && confidence < 0.6
  return {
    kind: record.kind === 'algorithm_method_lineage' && !lowConfidenceLineage ? 'algorithm_method_lineage' : 'generic_related_papers',
    confidence,
    queryFocus: typeof record.queryFocus === 'string' && record.queryFocus.trim() ? record.queryFocus.trim() : fallback.queryFocus,
    rationale: typeof record.rationale === 'string' && record.rationale.trim() ? record.rationale.trim() : fallback.rationale,
    fallbackReason: fallbackReason ?? (lowConfidenceLineage ? '分类置信度低，降级为相关论文展开。' : undefined)
  }
}

function normalizePaperMethodDigest(
  value: unknown,
  fallback: { id: string; paperTitle: string }
): PaperMethodDigest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const paperId = typeof record.paperId === 'string' && record.paperId.trim() ? record.paperId.trim() : fallback.id
  const problemSetting = typeof record.problemSetting === 'string' && record.problemSetting.trim() ? record.problemSetting.trim() : ''
  const coreMechanism = typeof record.coreMechanism === 'string' && record.coreMechanism.trim() ? record.coreMechanism.trim() : ''
  const evidenceSummary = typeof record.evidenceSummary === 'string' && record.evidenceSummary.trim() ? record.evidenceSummary.trim() : ''
  if (!paperId || !problemSetting || !coreMechanism || !evidenceSummary) return null

  const allowedRelationHints: PaperMethodDigest['relationHints'][number][] = [
    'foundation',
    'parallel_variant',
    'extends',
    'improves_limitation',
    'application_variant',
    'unclear'
  ]
  const rawRelationHints = Array.isArray(record.relationHints) ? record.relationHints : [record.relationHints]
  const relationHints = rawRelationHints.filter(
    (hint): hint is PaperMethodDigest['relationHints'][number] => typeof hint === 'string' && allowedRelationHints.includes(hint as PaperMethodDigest['relationHints'][number])
  )
  const confidence = normalizeConfidence(record.confidence)

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : stableId('digest', paperId),
    paperId,
    paperTitle: typeof record.paperTitle === 'string' && record.paperTitle.trim() ? record.paperTitle.trim() : fallback.paperTitle,
    methodName: typeof record.methodName === 'string' && record.methodName.trim() ? record.methodName.trim() : undefined,
    problemSetting,
    coreMechanism,
    claimedImprovement: typeof record.claimedImprovement === 'string' && record.claimedImprovement.trim() ? record.claimedImprovement.trim() : undefined,
    limitation: typeof record.limitation === 'string' && record.limitation.trim() ? record.limitation.trim() : undefined,
    relationHints: relationHints.length ? relationHints : ['unclear'],
    evidenceSummary,
    confidence: confidence ?? 0.4,
    insufficientInformation:
      typeof record.insufficientInformation === 'string' && record.insufficientInformation.trim()
        ? record.insufficientInformation.trim()
        : undefined
  }
}

function normalizeConfidence(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'high') return 0.85
  if (normalized === 'medium') return 0.6
  if (normalized === 'low') return 0.35
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeMethodLineageView(value: unknown): MethodLineageView | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const hasString = (key: string): boolean => typeof record[key] === 'string' && Boolean(record[key].trim())
  const hasArray = (key: string): boolean => Array.isArray(record[key])
  const dataCompleteness = record.dataCompleteness
  const allowedNodeRoles = new Set<MethodLineageView['nodes'][number]['role']>([
    'current_method',
    'foundation_method',
    'parallel_variant',
    'improvement',
    'application_variant',
    'open_problem'
  ])
  const allowedEdgeRelations = new Set<MethodLineageView['edges'][number]['relation']>([
    'extends',
    'contrasts_with',
    'solves_limitation_of',
    'shares_assumption_with',
    'applies_to_new_context',
    'evidence_insufficient'
  ])
  const isStringArray = (input: unknown): input is string[] => Array.isArray(input) && input.every((item) => typeof item === 'string')
  const isValidNode = (input: unknown): boolean => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false
    const node = input as Record<string, unknown>
    return (
      typeof node.id === 'string' &&
      Boolean(node.id.trim()) &&
      typeof node.label === 'string' &&
      Boolean(node.label.trim()) &&
      typeof node.summary === 'string' &&
      Boolean(node.summary.trim()) &&
      typeof node.role === 'string' &&
      allowedNodeRoles.has(node.role as MethodLineageView['nodes'][number]['role']) &&
      isStringArray(node.representativePaperIds) &&
      isStringArray(node.digestIds)
    )
  }
  const isValidEdge = (input: unknown): boolean => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false
    const edge = input as Record<string, unknown>
    return (
      typeof edge.id === 'string' &&
      Boolean(edge.id.trim()) &&
      typeof edge.sourceId === 'string' &&
      Boolean(edge.sourceId.trim()) &&
      typeof edge.targetId === 'string' &&
      Boolean(edge.targetId.trim()) &&
      typeof edge.explanation === 'string' &&
      Boolean(edge.explanation.trim()) &&
      typeof edge.relation === 'string' &&
      allowedEdgeRelations.has(edge.relation as MethodLineageView['edges'][number]['relation']) &&
      isStringArray(edge.evidencePaperIds) &&
      typeof edge.confidence === 'number' &&
      Number.isFinite(edge.confidence)
    )
  }

  if (!hasString('id') || !hasString('anchorNodeId') || !hasString('title') || !hasString('summary')) return undefined
  if (!hasArray('nodes') || !hasArray('edges') || !hasArray('openQuestions') || !hasArray('readingOrder')) return undefined
  if (!hasArray('missingDataReasons')) return undefined
  if (dataCompleteness !== 'complete' && dataCompleteness !== 'partial' && dataCompleteness !== 'insufficient') return undefined
  if (!isStringArray(record.openQuestions) || !isStringArray(record.readingOrder) || !isStringArray(record.missingDataReasons)) return undefined
  const nodes = record.nodes as unknown[]
  const edges = record.edges as unknown[]
  if (!nodes.every(isValidNode) || !edges.every(isValidEdge)) return undefined

  return record as unknown as MethodLineageView
}

function createPaperRecord(paperId: string, title: string, fileUrl?: string, filePath?: string): PaperRecord {
  const timestamp = now()
  return {
    id: paperId,
    title,
    authors: [],
    externalIds: [{ provider: 'local', externalId: `local:${paperId}` }],
    source: 'uploaded_pdf',
    sourceUrl: fileUrl,
    pdfUrl: fileUrl,
    localPdfPath: filePath,
    localFileId: paperId,
    importedAt: timestamp,
    analysisStatus: 'analyzed',
    graphVersion: 'kg3.0-json-repository',
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function isKg4ExpansionRecordQuery(value: unknown): value is Kg4ExpansionRecordQuery {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).paperId === 'string' &&
    typeof (value as Record<string, unknown>).nodeId === 'string'
  )
}

const KG4_JOB_TERMINAL_STATUSES = new Set<LLMJob['status']>(['succeeded', 'cache_hit', 'failed', 'cancelled'])

function logBackend(event: string, details: Record<string, unknown>): void {
  console.info(`[Backend] ${event}`, details)
}

async function waitForJobTerminalState(jobId: string, timeoutMs = 130000): Promise<LLMJob> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    const snapshot = await paperMemoryRepository.getSnapshot()
    const job = snapshot.llmJobs.find((item) => item.id === jobId)
    if (job && KG4_JOB_TERMINAL_STATUSES.has(job.status)) return job
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`展开任务等待后台重试超时: ${jobId}`)
}

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: false,
      plugins: false
    },
    title: 'Kapalytics - AI Paper Learning Assistant'
  })

  // Dev diagnostics: log renderer crashes and console errors
  if (isDev) {
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('[Main] Renderer crashed:', details.reason, 'exit:', details.exitCode)
    })
    mainWindow.webContents.on('unresponsive', () => {
      console.warn('[Main] Renderer unresponsive')
    })
    mainWindow.webContents.on('console-message', (_e, _level, message) => {
      if (message.startsWith('[ErrorBoundary]') || message.includes('Error:')) {
        console.error('[Renderer]', message)
      }
    })
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = details.url
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

function registerIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('select-pdf', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择论文 PDF',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return { fileUrl: pathToFileURL(filePath).toString(), filePath }
  })

  ipcMain.handle('pdf:read-file', async (_e, fileUrl: string) => {
    try {
      const buf = readFileSync(fileURLToPath(fileUrl))
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    } catch (err) {
      console.error('[PDF read]', err)
      return null
    }
  })

  // PDF text extraction — returns structured ExtractedPaperContent
  ipcMain.handle('pdf:extract-text', async (_e, fileUrl: string) => {
    try {
      return await extractPdfContent(fileUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[PDF extract]', msg)
      return { error: msg }
    }
  })

  // LLM handlers
  ipcMain.handle('llm:set-api-key', (_e, key: string) => {
    setApiKey(key)
  })

  ipcMain.handle('llm:clear-api-key', () => {
    clearApiKey()
  })

  ipcMain.handle('llm:has-api-key', () => {
    return hasApiKey()
  })

  ipcMain.handle('llm:get-config', () => {
    return getLlmConfig()
  })

  ipcMain.handle('llm:get-providers', () => {
    return getAvailableProviders()
  })

  ipcMain.handle('llm:set-provider', (_e, providerId: string) => {
    if (providerId === 'deepseek') setProvider(deepseekProvider)
  })

  ipcMain.handle('llm:set-proxy-url', (_e, proxyUrl: string | null) => {
    setProxyUrl(proxyUrl)
  })

  ipcMain.handle('llm:set-semantic-scholar-api-key', (_e, key: string) => {
    setSemanticScholarApiKey(key.trim())
  })

  ipcMain.handle('llm:clear-semantic-scholar-api-key', () => {
    clearSemanticScholarApiKey()
  })

  ipcMain.handle('llm:test-connection', async () => {
    try {
      if (!hasApiKey()) return { ok: false, message: '请先配置 DeepSeek API Key' }
      await callLlm({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
        temperature: 0,
        timeoutMs: 20000
      })
      return { ok: true, message: '连接成功' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.startsWith('TIMEOUT:')) return { ok: false, message: message.replace('TIMEOUT:', '') }
      if (message.startsWith('NETWORK_ERROR:')) return { ok: false, message: message.replace('NETWORK_ERROR:', '') }
      if (message.startsWith('API_ERROR:401')) return { ok: false, message: 'API Key 无效或已过期' }
      if (message.startsWith('API_ERROR:429')) return { ok: false, message: '请求过于频繁或额度受限，请稍后重试' }
      if (message.startsWith('API_ERROR:')) return { ok: false, message: `DeepSeek API 返回错误：${message}` }
      return { ok: false, message: `连接失败：${message}` }
    }
  })

  ipcMain.handle(
    'llm:diagnose',
    async (
      _e,
      params: { stageId: string; stageName: string; taskDescription: string; userAnswer: string }
    ) => {
      return aiDiagnose(params.stageId, params.stageName, params.taskDescription, params.userAnswer)
    }
  )

  ipcMain.handle('llm:analyze-paper', async (_e, content) => {
    const send = (msg: string) => mainWindow.webContents.send('llm:progress', msg)
    return aiAnalyzePaper(content, send)
  })

  // Storage handlers
  ipcMain.handle('storage:save', (_e, data: unknown) => {
    try {
      writeFileSync(getStoragePath(), JSON.stringify(data, null, 2), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('storage:load', () => {
    try {
      const path = getStoragePath()
      if (!existsSync(path)) return null
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      return null
    }
  })

  ipcMain.handle('kg3:get-memory-snapshot', () => paperMemoryRepository.getSnapshot())

  ipcMain.handle('kg3:search-papers', async (_e, query) => {
    logBackend('kg3_search_papers', { query })
    const { candidates, providerStatus } = await searchPapers(query)
    logBackend('kg3_search_papers_result', { candidateCount: candidates.length, providerStatus })
    return { retrievedPapers: candidates, mergedNodes: [], mergeCandidates: [], providerStatus }
  })

  ipcMain.handle('retrieval:test-search', async (_e, rawQuery: unknown) => {
    const query = typeof rawQuery === 'string' && rawQuery.trim() ? rawQuery.trim() : 'hypernetwork meta-learning'
    const { candidates, providerStatus } = await searchPapers({
      query,
      searchQueries: [query],
      maxResults: 5,
      requireAbstract: true
    })
    return toRetrievalConnectionTestResult({ query, candidates, providerStatus })
  })

  ipcMain.handle('kg3:save-current-graph', async (_e, payload: { paperId: string; title: string; fileUrl?: string; filePath?: string; data: unknown }) => {
    const data = payload.data as {
      graph?: { nodes?: GraphNode[]; edges?: GraphEdge[] }
      paperInsight?: PaperInsight | null
    }
    const paperId = payload.paperId || stableId('paper', payload.title)
    logBackend('kg3_save_current_graph', {
      paperId,
      title: payload.title,
      nodeCount: data.graph?.nodes?.length ?? 0,
      edgeCount: data.graph?.edges?.length ?? 0,
      hasInsight: Boolean(data.paperInsight)
    })
    await paperMemoryRepository.savePaper(createPaperRecord(paperId, payload.title || paperId, payload.fileUrl, payload.filePath))
    await paperMemoryRepository.saveGraphForPaper(paperId, data.graph?.nodes ?? [], data.graph?.edges ?? [], data.paperInsight ?? undefined)
    return { ok: true, paperId }
  })

  ipcMain.handle('kg3:fuse-paper-graph', async (_e, paperId: string) => {
    logBackend('kg3_fuse_paper_graph', { paperId })
    const fusion = await fusePaperGraph(paperId)
    logBackend('kg3_fuse_paper_graph_result', { paperId, mergedNodeCount: fusion.mergedNodes.length, candidateCount: fusion.candidates.length })
    return { retrievedPapers: [], mergedNodes: fusion.mergedNodes, mergeCandidates: fusion.candidates, providerStatus: [] }
  })

  ipcMain.handle('kg3:create-llm-job', async (_e, payload: { type: Parameters<typeof llmTaskOrchestrator.createJob>[0]['type']; input: unknown; paperId?: string; nodeId?: string; relatedPaperIds?: string[] }) => {
    logBackend('kg3_create_llm_job', { type: payload.type, paperId: payload.paperId, nodeId: payload.nodeId, relatedPaperIds: payload.relatedPaperIds })
    return llmTaskOrchestrator.createJob(payload)
  })

  ipcMain.handle('kg3:run-llm-job', async (_e, jobId: string) => {
    logBackend('kg3_run_llm_job', { jobId })
    return llmTaskOrchestrator.runJob(jobId)
  })

  ipcMain.handle('kg3:cancel-llm-job', async (_e, jobId: string) => {
    await llmTaskOrchestrator.cancel(jobId)
  })

  ipcMain.handle('kg4:save-node-understanding-memory', async (_e, record) => {
    await paperMemoryRepository.saveNodeUnderstandingMemory(record)
    return { ok: true }
  })

  ipcMain.handle('kg4:list-node-understanding-memories', async (_e, query) => {
    return paperMemoryRepository.listNodeUnderstandingMemories(query)
  })

  ipcMain.handle('kg4:find-reusable-node-memories', async (_e, params: { nodeId: string; topicTags?: string[]; methodFamilyTags?: string[]; limit?: number }) => {
    const snapshot = await paperMemoryRepository.getSnapshot()
    const node = snapshot.graphNodes.find((item) => item.id === params.nodeId || item.id.endsWith(`:${params.nodeId}`))
    if (!node) return []
    return paperMemoryRepository.findReusableNodeMemories({
      node,
      topicTags: params.topicTags ?? node.searchQueries,
      methodFamilyTags: params.methodFamilyTags ?? [],
      limit: params.limit
    })
  })

  ipcMain.handle('kg4:get-expansion-record', async (_e, params: unknown) => {
    if (!isKg4ExpansionRecordQuery(params)) return null
    logBackend('kg4_get_expansion_record', { paperId: params.paperId, nodeId: params.nodeId })
    const record = await paperMemoryRepository.getKg4ExpansionRecord(params.paperId, params.nodeId)
    logBackend('kg4_get_expansion_record_result', { paperId: params.paperId, nodeId: params.nodeId, found: Boolean(record) })
    return record && isKg4NodeExpansionRecord(record) ? record : null
  })

  ipcMain.handle('kg4:save-expansion-record', async (_e, record: Kg4NodeExpansionRecord) => {
    if (!isKg4NodeExpansionRecord(record)) throw new Error('invalid_kg4_expansion_record')
    logBackend('kg4_save_expansion_record', { paperId: record.paperId, nodeId: record.nodeId, expansionNodeCount: record.expansionGraphNodes.length })
    await paperMemoryRepository.saveKg4ExpansionRecord(record)
    return { ok: true }
  })

  ipcMain.handle('kg4:start-expansion', async (_e, params: StartKg4ExpansionParams) => {
    const sessionId = params.sessionId ?? `expansion_${params.nodeId}_${Date.now()}`
    logBackend('kg4_start_expansion', {
      sessionId,
      paperId: params.paperId,
      nodeId: params.nodeId,
      nodeLabel: params.nodeLabel,
      searchQueries: params.searchQueries,
      forceRefresh: Boolean(params.forceRefresh)
    })

    const runExpansion = async (): Promise<void> => {
      let jobId = ''
      try {
        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'job_created',
          message: '正在准备检索任务...'
        })

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'classifying',
          message: '正在判断展开意图...'
        })

        const classifyJob = await llmTaskOrchestrator.createJob({
          type: 'classify_expansion_intent',
          input: {
            currentNode: {
              id: params.nodeId,
              label: params.nodeLabel,
              searchQueries: params.searchQueries ?? []
            },
            currentPaperInsight: params.paperInsight
          },
          nodeId: params.nodeId,
          paperId: params.paperId,
          sessionId,
          model: 'deepseek-v4-flash',
          maxTokens: KG4_EXPANSION_TOKEN_BUDGETS.classifyExpansionIntent,
          temperature: 0.1
        })
        jobId = classifyJob.id

        let classifyResult = await llmTaskOrchestrator.runJob(classifyJob.id)
        if (classifyResult.status === 'queued' || classifyResult.status === 'running') {
          classifyResult = await waitForJobTerminalState(classifyJob.id)
        }
        const expansionClassification = normalizeExpansionClassification(
          classifyResult.status === 'succeeded' || classifyResult.status === 'cache_hit' ? classifyResult.resultJson : undefined,
          { nodeLabel: params.nodeLabel }
        )
        const expansionIntent = classificationToLegacyIntent(expansionClassification, params.nodeLabel)
        const retrievalPlan = buildStrategyRetrievalPlan({
          classification: expansionClassification,
          node: {
            id: params.nodeId,
            label: params.nodeLabel,
            searchQueries: params.searchQueries ?? []
          }
        })

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'retrieving',
          message: '正在检索相关论文...'
        })

        const { candidates, providerStatus } = await searchPapers({
          query: retrievalPlan.primaryQuery,
          nodeId: params.nodeId,
          paperId: params.paperId,
          searchQueries: retrievalPlan.searchQueries,
          maxResults: retrievalPlan.maxResults,
          requireAbstract: retrievalPlan.requireAbstract
        })
        const relatedPaperIds = candidates.map(candidatePaperId)
        const qualitySignals = annotatePaperQuality(candidates)
        const relatedPaperRecommendations = buildRelatedPaperRecommendations(candidates, qualitySignals)
        logBackend('kg4_expansion_retrieval_result', {
          sessionId,
          nodeId: params.nodeId,
          intent: expansionIntent.kind,
          retrievalGoal: retrievalPlan.retrievalGoal,
          query: retrievalPlan.primaryQuery,
          candidateCount: candidates.length,
          relatedPaperIds,
          providerStatus
        })

        if (expansionIntent.kind === 'generic_related_papers' || candidates.length < 2) {
          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'generating',
            message: '正在生成扩展图谱...'
          })

          const record = assembleLineageExpansionRecord({
            paperId: params.paperId ?? 'current-paper',
            nodeId: params.nodeId,
            jobIds: [classifyJob.id],
            intent: expansionIntent,
            retrievedPapers: candidates,
            paperMethodDigests: [],
            methodLineageView: undefined,
            classification: expansionClassification,
            qualitySignals,
            relatedPaperRecommendations,
          })
          if (candidates.length < 2) record.missingDataReasons = ['可用论文不足，未生成方法谱系。']
          logBackend('kg4_expansion_record_built', {
            sessionId,
            jobId,
            paperId: record.paperId,
            nodeId: record.nodeId,
            retrievedPaperCount: record.retrievedPaperIds.length,
            digestCount: record.paperMethodDigests?.length ?? 0,
            lineageNodeCount: record.methodLineageView?.nodes.length ?? 0,
            ideaCardCount: record.algorithmIdeaCards.length,
            expansionNodeCount: record.expansionGraphNodes.length,
            dataCompleteness: record.dataCompleteness,
            missingDataReasons: record.missingDataReasons
          })

          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'persisting',
            message: '正在保存展开结果...'
          })
          await paperMemoryRepository.saveKg4ExpansionRecord(record)
          logBackend('kg4_expansion_record_saved', { sessionId, recordId: record.id })

          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'done',
            message: '展开完成',
            result: record
          })
          return
        }

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'digesting',
          message: '正在提炼候选论文的方法摘要...'
        })

        const digestJobs = await mapWithConcurrency(
          candidates,
          3,
          async (candidate) => {
            const paperId = candidatePaperId(candidate)
            const digestJob = await llmTaskOrchestrator.createJob({
              type: 'digest_paper_method',
              input: {
                currentNode: {
                  id: params.nodeId,
                  label: params.nodeLabel,
                  searchQueries: params.searchQueries ?? []
                },
                currentPaperInsight: params.paperInsight,
                retrievedPaper: candidate
              },
              nodeId: params.nodeId,
              paperId: params.paperId,
              relatedPaperIds: [paperId],
              sessionId,
              model: 'deepseek-v4-flash',
              maxTokens: KG4_EXPANSION_TOKEN_BUDGETS.digestPaperMethod,
              temperature: 0.1
            })

            let digestResult = await llmTaskOrchestrator.runJob(digestJob.id)
            if (digestResult.status === 'queued' || digestResult.status === 'running') {
              digestResult = await waitForJobTerminalState(digestJob.id)
            }

            return {
              jobId: digestJob.id,
              digest:
                digestResult.status === 'succeeded' || digestResult.status === 'cache_hit'
                  ? normalizePaperMethodDigest(digestResult.resultJson, { id: paperId, paperTitle: candidate.title })
                  : null
            }
          }
        )
        const paperMethodDigests = digestJobs
          .map((item) => item.digest)
          .filter((digest): digest is PaperMethodDigest => digest !== null)
        const digestJobIds = digestJobs.map((item) => item.jobId)

        if (paperMethodDigests.length < 2) {
          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'generating',
            message: '正在生成可读的方法摘要结果...'
          })

          const record = assembleLineageExpansionRecord({
            paperId: params.paperId ?? 'current-paper',
            nodeId: params.nodeId,
            jobIds: [classifyJob.id, ...digestJobIds],
            intent: expansionIntent,
            retrievedPapers: candidates,
            paperMethodDigests,
            methodLineageView: undefined,
            classification: expansionClassification,
            qualitySignals,
            relatedPaperRecommendations,
          })
          record.missingDataReasons = ['可用方法摘要少于 2 个，未生成方法谱系。']
          logBackend('kg4_expansion_record_built', {
            sessionId,
            jobId,
            paperId: record.paperId,
            nodeId: record.nodeId,
            retrievedPaperCount: record.retrievedPaperIds.length,
            digestCount: record.paperMethodDigests?.length ?? 0,
            lineageNodeCount: record.methodLineageView?.nodes.length ?? 0,
            ideaCardCount: record.algorithmIdeaCards.length,
            expansionNodeCount: record.expansionGraphNodes.length,
            dataCompleteness: record.dataCompleteness,
            missingDataReasons: record.missingDataReasons
          })

          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'persisting',
            message: '正在保存展开结果...'
          })
          await paperMemoryRepository.saveKg4ExpansionRecord(record)
          logBackend('kg4_expansion_record_saved', { sessionId, recordId: record.id })

          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'done',
            message: '展开完成',
            result: record
          })
          return
        }

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'synthesizing',
          message: '正在综合方法谱系...'
        })

        const lineageJob = await llmTaskOrchestrator.createJob({
          type: 'synthesize_method_lineage',
          input: {
            requestNonce: params.forceRefresh ? Date.now() : undefined,
            currentNode: {
              id: params.nodeId,
              label: params.nodeLabel,
              searchQueries: params.searchQueries ?? []
            },
            currentPaperInsight: params.paperInsight,
            retrievedPapers: compactRetrievedPapersForLineage(candidates),
            paperMethodDigests
          },
          nodeId: params.nodeId,
          paperId: params.paperId,
          relatedPaperIds,
          sessionId,
          model: 'deepseek-v4-pro',
          maxTokens: KG4_EXPANSION_TOKEN_BUDGETS.synthesizeMethodLineage,
          temperature: 0.1
        })
        jobId = lineageJob.id
        logBackend('kg4_expansion_job_created', { sessionId, jobId, nodeId: params.nodeId, relatedPaperCount: relatedPaperIds.length })

        let lineageResult = await llmTaskOrchestrator.runJob(lineageJob.id)
        if (lineageResult.status === 'queued' || lineageResult.status === 'running') {
          lineageResult = await waitForJobTerminalState(lineageJob.id)
        }
        logBackend('kg4_expansion_job_result', { sessionId, jobId, status: lineageResult.status, errorMessage: lineageResult.errorMessage })
        const methodLineageView = normalizeMethodLineageView(
          lineageResult.status === 'succeeded' || lineageResult.status === 'cache_hit' ? lineageResult.resultJson : undefined
        )

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'generating',
          message: '正在生成扩展图谱...'
        })

        const record = assembleLineageExpansionRecord({
          paperId: params.paperId ?? 'current-paper',
          nodeId: params.nodeId,
          jobIds: [classifyJob.id, ...digestJobIds, lineageJob.id],
          intent: expansionIntent,
          retrievedPapers: candidates,
          paperMethodDigests,
          methodLineageView,
          classification: expansionClassification,
          qualitySignals,
          relatedPaperRecommendations,
        })
        if (!methodLineageView) {
          record.missingDataReasons = ['方法谱系汇总失败，展示论文方法摘要。']
        }
        logBackend('kg4_expansion_record_built', {
          sessionId,
          jobId,
          paperId: record.paperId,
          nodeId: record.nodeId,
          retrievedPaperCount: record.retrievedPaperIds.length,
          digestCount: record.paperMethodDigests?.length ?? 0,
          lineageNodeCount: record.methodLineageView?.nodes.length ?? 0,
          ideaCardCount: record.algorithmIdeaCards.length,
          expansionNodeCount: record.expansionGraphNodes.length,
          dataCompleteness: record.dataCompleteness,
          missingDataReasons: record.missingDataReasons
        })

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'persisting',
          message: '正在保存展开结果...'
        })
        await paperMemoryRepository.saveKg4ExpansionRecord(record)
        logBackend('kg4_expansion_record_saved', { sessionId, recordId: record.id })

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'done',
          message: '展开完成',
          result: record
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logBackend('kg4_expansion_failed', { sessionId, jobId, nodeId: params.nodeId, message })
        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'failed',
          message,
          error: message
        })
      }
    }

    setTimeout(() => { void runExpansion() }, 0)

    return { sessionId, jobs: [] }
  })

  ipcMain.handle('kg4:get-job-status', async (_e, jobId: string) => {
    const snapshot = await paperMemoryRepository.getSnapshot()
    const job = snapshot.llmJobs.find((j) => j.id === jobId)
    if (!job) return { status: 'not_found' }
    return {
      status: job.status,
      progressStep: job.progressStep,
      progressMessage: job.progressMessage,
      errorMessage: job.errorMessage
    }
  })

  ipcMain.handle('kg4:cancel-job', async (_e, jobId: string) => {
    await llmTaskOrchestrator.cancel(jobId)
  })
}

app.whenReady().then(() => {
  const mainWindow = createWindow()
  registerIpcHandlers(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
