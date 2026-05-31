import type { ExpansionIntent, ExpansionRetrievalPlan } from '../../shared/kg4'
import { isRecord, readString } from './lineageTypes'

export function buildExpansionRetrievalPlan(params: {
  intent: ExpansionIntent
  node: { id: string; label: string; searchQueries?: string[] }
  paperInsight?: unknown
}): ExpansionRetrievalPlan {
  const searchQueries = params.node.searchQueries?.filter((query) => query.trim()).map((query) => query.trim()) ?? []
  const uniqueQueries = (queries: string[]): string[] => [...new Set(queries.map((query) => query.trim()).filter(Boolean))]

  if (params.intent.kind === 'algorithm_method_lineage') {
    const fallbackQuery = uniqueQueries([params.intent.queryFocus, params.node.label, 'algorithm method lineage']).join(' ')
    const queries = uniqueQueries([...searchQueries, params.intent.queryFocus, params.node.label])

    return {
      primaryQuery: queries[0] ?? fallbackQuery,
      searchQueries: queries,
      retrievalGoal: 'same_problem_methods',
      maxResults: 8,
      requireAbstract: true
    }
  }

  const genericQueries = uniqueQueries([...searchQueries, params.intent.queryFocus, params.node.label])

  return {
    primaryQuery: genericQueries[0] ?? `${params.node.label} related papers`,
    searchQueries: genericQueries,
    retrievalGoal: 'generic_related_papers',
    maxResults: 8,
    requireAbstract: true
  }
}
