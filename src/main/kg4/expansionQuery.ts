import type { ExpansionIntent, ExpansionNodeClassification, ExpansionRetrievalPlan } from '../../shared/kg4'
import { isRecord, readString } from './lineageTypes'

export function buildExpansionRetrievalPlan(params: {
  intent: ExpansionIntent
  node: { id: string; label: string; searchQueries?: string[] }
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

export function buildStrategyRetrievalPlan(params: {
  classification: ExpansionNodeClassification
  node: { id: string; label: string; searchQueries?: string[] }
}): import('../../shared/kg4').ExpansionRetrievalPlan {
  const searchQueries = params.node.searchQueries?.filter((query) => query.trim()).map((query) => query.trim()) ?? []
  const uniqueQueries = (queries: string[]): string[] => [...new Set(queries.map((query) => query.trim()).filter(Boolean))]
  type Plan = import('../../shared/kg4').ExpansionRetrievalPlan
  const baseQueries = uniqueQueries([...searchQueries, params.node.label])

  if (params.classification.recommendedPath === 'learn_concept') {
    const queries = uniqueQueries([
      ...baseQueries,
      `${params.node.label} survey tutorial foundation`,
      `${params.node.label} mathematical formulation`
    ])
    return {
      primaryQuery: queries[0] ?? `${params.node.label} survey tutorial foundation`,
      searchQueries: queries,
      retrievalGoal: 'concept_learning_papers',
      maxResults: 8,
      requireAbstract: true
    } satisfies Plan
  }

  if (params.classification.recommendedPath === 'explore_research_area') {
    const queries = uniqueQueries([...baseQueries, `${params.node.label} survey recent advances`, `${params.node.label} benchmark methods`])
    return {
      primaryQuery: queries[0] ?? `${params.node.label} recent advances`,
      searchQueries: queries,
      retrievalGoal: 'research_area_papers',
      maxResults: 10,
      requireAbstract: true
    } satisfies Plan
  }

  if (params.classification.recommendedPath === 'inspect_paper_evidence') {
    const queries = uniqueQueries([...baseQueries, `${params.node.label} method evidence`])
    return {
      primaryQuery: queries[0] ?? `${params.node.label} method evidence`,
      searchQueries: queries,
      retrievalGoal: 'paper_evidence',
      maxResults: 6,
      requireAbstract: true
    } satisfies Plan
  }

  if (params.classification.recommendedPath === 'track_method_lineage') {
    return buildExpansionRetrievalPlan({
      intent: {
        kind: 'algorithm_method_lineage',
        confidence: params.classification.confidence,
        queryFocus: params.node.label,
        rationale: params.classification.rationale
      },
      node: params.node
    })
  }

  if (params.classification.recommendedPath === 'review_related_papers') {
    return buildExpansionRetrievalPlan({
      intent: {
        kind: 'generic_related_papers',
        confidence: params.classification.confidence,
        queryFocus: 'related papers',
        rationale: params.classification.rationale
      },
      node: params.node
    })
  }

  return buildExpansionRetrievalPlan({
    intent: {
      kind: 'generic_related_papers',
      confidence: params.classification.confidence,
      queryFocus: 'related papers',
      rationale: params.classification.rationale
    },
    node: params.node
  })
}
