import type { KnowledgeGraph, PaperInsight } from '../../../../shared/paper'
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'
import type { WorkspaceState } from '../../modules/workspace/types'

export interface SavePayload {
  stages: Stage[]
  answers: Record<string, string>
  diagnosisResults: Record<string, DiagnosisResult>
  learningReport: LearningReport | null
  pdfUrl: string | null
  workspaceState: WorkspaceState
  graph: KnowledgeGraph
  paperInsight: PaperInsight | null
}
