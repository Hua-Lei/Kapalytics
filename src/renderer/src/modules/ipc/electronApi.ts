import type { ElectronApi } from '../../../../shared/electron-api'

function getApi(): ElectronApi | undefined {
  return window.electronAPI
}

export const electronApi = {
  hasKey: () => getApi()?.llm?.hasApiKey?.().catch(() => false) ?? Promise.resolve(false),
  testConnection: () => getApi()?.llm?.testConnection?.().catch(() => false) ?? Promise.resolve(false),
  diagnose: (params: Parameters<ElectronApi['llm']['diagnose']>[0]) =>
    getApi()?.llm?.diagnose?.(params) ?? Promise.reject(new Error('API unavailable')),
  analyzePaper: (paperText: string) =>
    getApi()?.llm?.analyzePaper?.(paperText) ?? Promise.reject(new Error('API unavailable')),
  setKey: (key: string) => getApi()?.llm?.setApiKey?.(key) ?? Promise.resolve(),
  clearKey: () => getApi()?.llm?.clearApiKey?.() ?? Promise.resolve(),
  load: () => getApi()?.storage?.load?.() ?? Promise.resolve(null),
  save: (data: unknown) => getApi()?.storage?.save?.(data) ?? Promise.resolve({ ok: false }),
  selectPdf: () => getApi()?.selectPdf?.() ?? Promise.resolve(null),
  extractPdfText: (url: string) => getApi()?.extractPdfText?.(url) ?? Promise.resolve(null),
  onLlmProgress: (cb: (msg: string) => void) => getApi()?.onLlmProgress?.(cb)
}
