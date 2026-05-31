import type { ResearchAreaView } from '../../shared/kg4'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

const ALLOWED_ROLES = new Set(['survey', 'foundation', 'recent_hot', 'representative', 'needs_review'])

export function normalizeResearchAreaView(value: unknown, context: { anchorNodeId: string }): ResearchAreaView | undefined {
  if (!isRecord(value)) return undefined
  const id = readString(value.id) ?? `ra_${context.anchorNodeId}`
  const title = readString(value.title)
  const overview = readString(value.overview)
  if (!title || !overview) return undefined

  const keyProblems = readStringArray(value.keyProblems)
  const methodFamilies = Array.isArray(value.methodFamilies)
    ? (value.methodFamilies as unknown[]).filter((m): m is { label: string; summary: string; representativePaperIds: string[] } => {
        if (!isRecord(m)) return false
        const label = readString(m.label)
        const summary = readString(m.summary)
        return Boolean(label && summary)
      }).map((m) => ({
        label: readString(m.label)!,
        summary: readString(m.summary)!,
        representativePaperIds: readStringArray(m.representativePaperIds)
      }))
    : []

  const recentHotDirections = Array.isArray(value.recentHotDirections)
    ? (value.recentHotDirections as unknown[]).filter((d): d is { label: string; summary: string; paperIds: string[]; confidence: number } => {
        if (!isRecord(d)) return false
        return Boolean(readString(d.label) && readString(d.summary))
      }).map((d) => ({
        label: readString(d.label)!,
        summary: readString(d.summary)!,
        paperIds: readStringArray(d.paperIds),
        confidence: typeof d.confidence === 'number' && Number.isFinite(d.confidence) ? Math.max(0, Math.min(1, d.confidence)) : 0.5
      }))
    : []

  const recommendedReading = Array.isArray(value.recommendedReading)
    ? (value.recommendedReading as unknown[]).filter((r): r is { paperId: string; reason: string; role: string } => {
        if (!isRecord(r)) return false
        return Boolean(readString(r.paperId) && readString(r.reason) && typeof r.role === 'string' && ALLOWED_ROLES.has(r.role))
      }).map((r) => ({
        paperId: readString(r.paperId)!,
        reason: readString(r.reason)!,
        role: r.role as ResearchAreaView['recommendedReading'][number]['role']
      }))
    : []

  return {
    id,
    anchorNodeId: value.anchorNodeId as string ?? context.anchorNodeId,
    title,
    overview,
    keyProblems,
    methodFamilies,
    recentHotDirections,
    recommendedReading
  }
}
