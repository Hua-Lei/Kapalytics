import type { AnalysisStep, AnalysisStepStatus, KnowledgeGraph } from '../../../../shared/paper'
import { EMPTY_GRAPH, INITIAL_ANALYSIS_STEPS } from '../../../../shared/paper'

const VALID_NODE_TYPES = new Set(['field', 'concept', 'problem', 'method', 'formula', 'experiment', 'limitation'])

export { EMPTY_GRAPH, INITIAL_ANALYSIS_STEPS }

export function updateStep(steps: AnalysisStep[], id: string, status: AnalysisStepStatus): AnalysisStep[] {
  return steps.map((step) => (step.id === id ? { ...step, status } : step))
}

export function markActiveStepFailed(steps: AnalysisStep[]): AnalysisStep[] {
  return steps.map((step) => (step.status === 'active' ? { ...step, status: 'error' } : step))
}

export function sanitizeGraph(raw: KnowledgeGraph): KnowledgeGraph {
  const nodes = raw.nodes
    .filter((node) => node.id && VALID_NODE_TYPES.has(node.type))
    .map((node, index) => ({
      ...node,
      x: Number.isFinite(node.x) ? node.x : 140 + (index % 4) * 170,
      y: Number.isFinite(node.y) ? node.y : 80 + Math.floor(index / 4) * 130
    }))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = raw.edges.filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
  return { nodes, edges }
}
