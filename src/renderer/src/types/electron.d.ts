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
      selectPdf: () => Promise<string | null>
      llm: {
        setApiKey: (key: string) => Promise<void>
        clearApiKey: () => Promise<void>
        hasApiKey: () => Promise<boolean>
        getProviders: () => Promise<{ name: string; id: string }[]>
        setProvider: (id: string) => Promise<void>
        diagnose: (params: {
          stageId: string
          stageName: string
          taskDescription: string
          userAnswer: string
        }) => Promise<DiagnosisResult>
      }
    }
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        ref?: React.Ref<HTMLElement>
      },
      HTMLElement
    >
  }
}
