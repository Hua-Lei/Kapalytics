import type { ConceptLearningView } from '../../shared/kg4'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

const ALLOWED_RELATIONS = new Set(['prerequisite', 'similar', 'contrasts_with', 'used_by', 'variant'])
const ALLOWED_COMPLETENESS = new Set(['complete', 'partial', 'insufficient'])

export function normalizeConceptLearningView(value: unknown, context: { anchorNodeId: string }): ConceptLearningView | undefined {
  if (!isRecord(value)) return undefined

  const id = readString(value.id) ?? `cv_${context.anchorNodeId}`
  const title = readString(value.title)
  if (!title) return undefined

  const qe = isRecord(value.quickExplanation) ? value.quickExplanation : null
  if (!qe) return undefined
  const intuition = readString(qe.intuition)
  const problemSolved = readString(qe.problemSolved)
  const coreMechanism = readString(qe.coreMechanism)
  const whenToUse = readString(qe.whenToUse)
  if (!intuition || !problemSolved || !coreMechanism || !whenToUse) return undefined

  const formalDef = isRecord(value.formalExplanation) ? (readString(value.formalExplanation.definition) ?? '') : ''
  const formulas = isRecord(value.formalExplanation) && Array.isArray(value.formalExplanation.formulas)
    ? (value.formalExplanation.formulas as unknown[]).filter((f): f is NonNullable<ConceptLearningView['formalExplanation']['formulas'][number]> => {
        if (!isRecord(f)) return false
        const latex = readString(f.latex)
        const explanation = readString(f.explanation)
        return Boolean(latex && explanation)
      })
    : []

  const assumptions = isRecord(value.formalExplanation) ? readStringArray(value.formalExplanation.assumptions) : []

  const misconceptions = Array.isArray(value.misconceptions)
    ? (value.misconceptions as unknown[]).filter((m): m is { misconception: string; correction: string } => {
        if (!isRecord(m)) return false
        return Boolean(readString(m.misconception) && readString(m.correction))
      })
    : []

  const relationMap = Array.isArray(value.relationMap)
    ? (value.relationMap as unknown[]).filter((r): r is ConceptLearningView['relationMap'][number] => {
        if (!isRecord(r)) return false
        const label = readString(r.label)
        const relation = readString(r.relation) as string
        const explanation = readString(r.explanation)
        return Boolean(label && ALLOWED_RELATIONS.has(relation) && explanation)
      })
    : []

  const representativePaperIds = readStringArray(value.representativePaperIds)
  const recentPaperIds = readStringArray(value.recentPaperIds)
  const dataCompleteness = ALLOWED_COMPLETENESS.has(value.dataCompleteness as string) ? value.dataCompleteness as ConceptLearningView['dataCompleteness'] : 'partial'
  const missingDataReasons = readStringArray(value.missingDataReasons)

  return {
    id,
    anchorNodeId: value.anchorNodeId as string ?? context.anchorNodeId,
    title,
    quickExplanation: { intuition, problemSolved, coreMechanism, whenToUse },
    formalExplanation: { definition: formalDef || '', formulas, assumptions },
    misconceptions,
    relationMap,
    representativePaperIds,
    recentPaperIds,
    dataCompleteness,
    missingDataReasons
  }
}
