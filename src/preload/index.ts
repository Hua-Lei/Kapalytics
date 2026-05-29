import { contextBridge, ipcRenderer } from 'electron'
import type { DiagnosisResult } from '../shared/electron-api'
import type { ExtractedPaperContent, PaperAnalysisResult } from '../shared/paper'
import type { Kg3ExpansionContext, Kg3MemorySnapshot, LLMJob, PaperSearchQuery } from '../shared/kg3'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  selectPdf: (): Promise<{ fileUrl: string; filePath: string } | null> => ipcRenderer.invoke('select-pdf'),
  readPdfFile: (fileUrl: string): Promise<ArrayBuffer | null> => ipcRenderer.invoke('pdf:read-file', fileUrl),
  extractPdfText: (fileUrl: string): Promise<ExtractedPaperContent | null> =>
    ipcRenderer.invoke('pdf:extract-text', fileUrl),
  onLlmProgress: (cb: (msg: string) => void) => {
    const handler = (_e: unknown, msg: string) => cb(msg)
    ipcRenderer.on('llm:progress', handler)
    return () => { ipcRenderer.removeListener('llm:progress', handler) }
  },

  llm: {
    setApiKey: (key: string): Promise<void> => ipcRenderer.invoke('llm:set-api-key', key),
    clearApiKey: (): Promise<void> => ipcRenderer.invoke('llm:clear-api-key'),
    hasApiKey: (): Promise<boolean> => ipcRenderer.invoke('llm:has-api-key'),
    getConfig: () => ipcRenderer.invoke('llm:get-config'),
    getProviders: (): Promise<{ name: string; id: string }[]> =>
      ipcRenderer.invoke('llm:get-providers'),
    setProxyUrl: (proxyUrl: string | null): Promise<void> => ipcRenderer.invoke('llm:set-proxy-url', proxyUrl),
    setProvider: (id: string): Promise<void> => ipcRenderer.invoke('llm:set-provider', id),
    testConnection: () => ipcRenderer.invoke('llm:test-connection'),
    diagnose: (params: {
      stageId: string
      stageName: string
      taskDescription: string
      userAnswer: string
    }): Promise<DiagnosisResult> => ipcRenderer.invoke('llm:diagnose', params),
    analyzePaper: (content: ExtractedPaperContent): Promise<PaperAnalysisResult> =>
      ipcRenderer.invoke('llm:analyze-paper', content)
  },

  storage: {
    save: (data: unknown): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('storage:save', data),
    load: (): Promise<unknown> => ipcRenderer.invoke('storage:load')
  },

  kg3: {
    getMemorySnapshot: (): Promise<Kg3MemorySnapshot> => ipcRenderer.invoke('kg3:get-memory-snapshot'),
    searchPapers: (query: PaperSearchQuery): Promise<Kg3ExpansionContext> => ipcRenderer.invoke('kg3:search-papers', query),
    saveCurrentGraph: (payload: { paperId: string; title: string; fileUrl?: string; filePath?: string; data: unknown }): Promise<{ ok: boolean; paperId: string }> =>
      ipcRenderer.invoke('kg3:save-current-graph', payload),
    fusePaperGraph: (paperId: string): Promise<Kg3ExpansionContext> => ipcRenderer.invoke('kg3:fuse-paper-graph', paperId),
    createLlmJob: (payload: { type: LLMJob['type']; input: unknown; paperId?: string; nodeId?: string; relatedPaperIds?: string[] }): Promise<LLMJob> =>
      ipcRenderer.invoke('kg3:create-llm-job', payload),
    runLlmJob: (jobId: string): Promise<LLMJob> => ipcRenderer.invoke('kg3:run-llm-job', jobId),
    cancelLlmJob: (jobId: string): Promise<void> => ipcRenderer.invoke('kg3:cancel-llm-job', jobId)
  }
})
