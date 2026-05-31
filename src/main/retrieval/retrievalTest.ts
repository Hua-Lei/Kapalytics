import type { DedupedPaperCandidate } from '../../shared/kg3'

export interface RetrievalConnectionTestResult {
  ok: boolean
  query: string
  candidateCount: number
  providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }>
  samplePapers: Array<{ title: string; sources: string[]; year?: number }>
  message: string
}

export function toRetrievalConnectionTestResult(params: {
  query: string
  candidates: DedupedPaperCandidate[]
  providerStatus: RetrievalConnectionTestResult['providerStatus']
}): RetrievalConnectionTestResult {
  const candidateCount = params.candidates.length
  const successProviders = params.providerStatus.filter((status) => status.status === 'success').length
  return {
    ok: candidateCount > 0,
    query: params.query,
    candidateCount,
    providerStatus: params.providerStatus,
    samplePapers: params.candidates.slice(0, 3).map((paper) => ({
      title: paper.title,
      sources: paper.sources,
      year: paper.year
    })),
    message: candidateCount > 0
      ? `检索完成：${successProviders} 个来源返回可用结果，共 ${candidateCount} 篇候选论文。`
      : '未检索到可用论文，请检查网络、代理或 provider API Key。'
  }
}
