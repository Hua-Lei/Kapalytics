import { contextBridge, ipcRenderer } from 'electron'
import type { DiagnosisResult } from '../shared/electron-api'
import type { ExtractedPaperContent, PaperAnalysisResult } from '../shared/paper'

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
    getProviders: (): Promise<{ name: string; id: string }[]> =>
      ipcRenderer.invoke('llm:get-providers'),
    setProvider: (id: string): Promise<void> => ipcRenderer.invoke('llm:set-provider', id),
    testConnection: (): Promise<boolean> => ipcRenderer.invoke('llm:test-connection'),
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
  }
})
