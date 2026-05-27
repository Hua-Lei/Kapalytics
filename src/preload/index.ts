import { contextBridge, ipcRenderer } from 'electron'

export interface DiagnosisResult {
  isCorrect: boolean
  errorType: string
  feedback: string
  remedialTask: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  selectPdf: (): Promise<string | null> => ipcRenderer.invoke('select-pdf'),

  // LLM API
  llm: {
    setApiKey: (key: string): Promise<void> => ipcRenderer.invoke('llm:set-api-key', key),
    clearApiKey: (): Promise<void> => ipcRenderer.invoke('llm:clear-api-key'),
    hasApiKey: (): Promise<boolean> => ipcRenderer.invoke('llm:has-api-key'),
    getProviders: (): Promise<{ name: string; id: string }[]> =>
      ipcRenderer.invoke('llm:get-providers'),
    setProvider: (id: string): Promise<void> => ipcRenderer.invoke('llm:set-provider', id),
    diagnose: (params: {
      stageId: string
      stageName: string
      taskDescription: string
      userAnswer: string
    }): Promise<DiagnosisResult> => ipcRenderer.invoke('llm:diagnose', params)
  },

  // Storage
  storage: {
    save: (data: unknown): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('storage:save', data),
    load: (): Promise<unknown> => ipcRenderer.invoke('storage:load')
  }
})
