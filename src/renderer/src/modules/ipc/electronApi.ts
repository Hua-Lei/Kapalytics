import type { ElectronApi } from '../../../../shared/electron-api'
import type { ExtractedPaperContent } from '../../../../shared/paper'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

function getApi(): ElectronApi | undefined {
  return window.electronAPI
}

function requireApi(): ElectronApi {
  const api = getApi()
  if (!api) throw new Error('Electron API unavailable')
  return api
}

async function extractPdfTextInRenderer(
  readPdfFile: ElectronApi['readPdfFile'],
  url: string
): Promise<ExtractedPaperContent> {
  const data = await readPdfFile(url)
  if (!data) throw new Error('无法读取 PDF 文件')

  const doc = await pdfjsLib.getDocument({ data }).promise
  const pages: ExtractedPaperContent['pages'] = []

  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/�/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    pages.push({ page: i, text })
  }

  return { pages, formulaCandidates: [] }
}

export const electronApi = {
  hasKey: () => getApi()?.llm?.hasApiKey?.().catch(() => false) ?? Promise.resolve(false),
  testConnection: () => getApi()?.llm?.testConnection?.().catch(() => false) ?? Promise.resolve(false),
  diagnose: (params: Parameters<ElectronApi['llm']['diagnose']>[0]) =>
    getApi()?.llm?.diagnose?.(params) ?? Promise.reject(new Error('API unavailable')),
  analyzePaper: (content: ExtractedPaperContent) =>
    getApi()?.llm?.analyzePaper?.(content) ?? Promise.reject(new Error('API unavailable')),
  setKey: (key: string) => getApi()?.llm?.setApiKey?.(key) ?? Promise.resolve(),
  clearKey: () => getApi()?.llm?.clearApiKey?.() ?? Promise.resolve(),
  load: () => getApi()?.storage?.load?.() ?? Promise.resolve(null),
  save: (data: unknown) => getApi()?.storage?.save?.(data) ?? Promise.resolve({ ok: false }),
  selectPdf: () => getApi()?.selectPdf?.() ?? Promise.resolve(null),
  extractPdfText: async (url: string) => {
    const api = requireApi()
    let content: ExtractedPaperContent | null | undefined
    try {
      content = await api.extractPdfText?.(url)
    } catch {
      content = null
    }
    if (content?.pages?.length) return content
    return extractPdfTextInRenderer(api.readPdfFile, url)
  },
  onLlmProgress: (cb: (msg: string) => void) => getApi()?.onLlmProgress?.(cb)
}
