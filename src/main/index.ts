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
  setProxyUrl
} from './llm/client'
import { deepseekProvider } from './llm/providers/deepseek'
import { extractPdfContent } from './paper/extractPdfContent'
import { paperMemoryRepository } from './memory/kg3Repository'
import { fusePaperGraph } from './memory/graphFusion'
import { searchPapers } from './retrieval/paperSearch'
import { llmTaskOrchestrator } from './llm/orchestrator'
import type { GraphEdge, GraphNode, PaperInsight } from '../shared/paper'
import type { PaperRecord } from '../shared/kg3'

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
    const { candidates, providerStatus } = await searchPapers(query)
    return { retrievedPapers: candidates, mergedNodes: [], mergeCandidates: [], providerStatus }
  })

  ipcMain.handle('kg3:save-current-graph', async (_e, payload: { paperId: string; title: string; fileUrl?: string; filePath?: string; data: unknown }) => {
    const data = payload.data as {
      graph?: { nodes?: GraphNode[]; edges?: GraphEdge[] }
      paperInsight?: PaperInsight | null
    }
    const paperId = payload.paperId || stableId('paper', payload.title)
    await paperMemoryRepository.savePaper(createPaperRecord(paperId, payload.title || paperId, payload.fileUrl, payload.filePath))
    await paperMemoryRepository.saveGraphForPaper(paperId, data.graph?.nodes ?? [], data.graph?.edges ?? [], data.paperInsight ?? undefined)
    return { ok: true, paperId }
  })

  ipcMain.handle('kg3:fuse-paper-graph', async (_e, paperId: string) => {
    const fusion = await fusePaperGraph(paperId)
    return { retrievedPapers: [], mergedNodes: fusion.mergedNodes, mergeCandidates: fusion.candidates, providerStatus: [] }
  })

  ipcMain.handle('kg3:create-llm-job', async (_e, payload: { type: Parameters<typeof llmTaskOrchestrator.createJob>[0]['type']; input: unknown; paperId?: string; nodeId?: string; relatedPaperIds?: string[] }) => {
    return llmTaskOrchestrator.createJob(payload)
  })

  ipcMain.handle('kg3:run-llm-job', async (_e, jobId: string) => {
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

  ipcMain.handle('kg4:start-expansion', async (_e, params: { nodeId: string; nodeLabel: string; paperId?: string }) => {
    const sessionId = `expansion_${params.nodeId}_${Date.now()}`
    const contextJob = await llmTaskOrchestrator.createJob({
      type: 'expand_node_retrieve_context',
      input: { nodeId: params.nodeId, nodeLabel: params.nodeLabel },
      nodeId: params.nodeId,
      paperId: params.paperId,
      sessionId
    })
    await llmTaskOrchestrator.enqueueJob(contextJob)
    return { sessionId, jobs: [{ jobId: contextJob.id, type: contextJob.type }] }
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
