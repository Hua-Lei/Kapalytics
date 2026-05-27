export {}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      selectPdf: () => Promise<string | null>
    }
  }
}
