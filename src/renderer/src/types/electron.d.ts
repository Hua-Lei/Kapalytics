export {}

interface DiagnosisResult {
  isCorrect: boolean
  errorType: string
  feedback: string
  remedialTask: string
}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      selectPdf: () => Promise<{ fileUrl: string; filePath: string } | null>
      readPdfFile: (fileUrl: string) => Promise<ArrayBuffer | null>
      extractPdfText: (fileUrl: string) => Promise<string | null>
      onLlmProgress: (cb: (msg: string) => void) => () => void
      storage: {
        save: (data: unknown) => Promise<{ ok: boolean; error?: string }>
        load: () => Promise<unknown>
      }
      llm: {
        setApiKey: (key: string) => Promise<void>
        clearApiKey: () => Promise<void>
        hasApiKey: () => Promise<boolean>
        getProviders: () => Promise<{ name: string; id: string }[]>
        setProvider: (id: string) => Promise<void>
        testConnection: () => Promise<boolean>
        diagnose: (params: {
          stageId: string
          stageName: string
          taskDescription: string
          userAnswer: string
        }) => Promise<DiagnosisResult>
        analyzePaper: (paperText: string) => Promise<{
          graph: {
            nodes: { id: string; type: string; label: string; description: string; x: number; y: number }[]
            edges: { id: string; sourceId: string; targetId: string; label?: string; directed: boolean }[]
          }
          tasks: Record<string, string>
        }>
      }
    }
  }
}
