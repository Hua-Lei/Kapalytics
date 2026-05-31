import type { ExpansionIntent, ExpansionRetrievalPlan } from '../../shared/kg4'
import { isRecord, readString } from './lineageTypes'

export function buildExpansionRetrievalPlan(params: {
  intent: ExpansionIntent
  node: { id: string; label: string; searchQueries?: string[] }
  paperInsight?: unknown
}): ExpansionRetrievalPlan {
  const insight = isRecord(params.paperInsight) ? params.paperInsight : {}
  const problem = readString(insight, 'problem')
  const method = readString(insight, 'method')
  const searchQueries = params.node.searchQueries?.filter((query) => query.trim()).map((query) => query.trim()) ?? []

  if (params.intent.kind === 'algorithm_method_lineage') {
    const parts = [
      params.node.label,
      params.intent.queryFocus,
      problem,
      method,
      ...searchQueries,
      'algorithm method same problem alternative approach foundation variant improvement'
    ].filter(Boolean)

    return {
      primaryQuery: parts.join(' '),
      searchQueries: [parts.join(' '), ...searchQueries],
      retrievalGoal: 'same_problem_methods',
      maxResults: 8,
      requireAbstract: true
    }
  }

  const genericParts = [params.node.label, params.intent.queryFocus, ...searchQueries, 'related papers'].filter(Boolean)

  return {
    primaryQuery: genericParts.join(' '),
    searchQueries: [genericParts.join(' '), ...searchQueries],
    retrievalGoal: 'generic_related_papers',
    maxResults: 8,
    requireAbstract: true
  }
}
