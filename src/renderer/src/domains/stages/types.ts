import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'

export interface StageState {
  stages: Stage[]
  selectedStageId: string | null
  answers: Record<string, string>
  drafts: Record<string, string>
  diagnosisResults: Record<string, DiagnosisResult>
  diagnosedStageIds: Set<string>
  learningReport: LearningReport | null
  diagnosisError: string | null
  diagnosisLoading: boolean
}

export interface StageActions {
  selectStage: (id: string | null) => void
  enterStage: (id: string) => void
  submitAnswer: (id: string) => Promise<void>
  confirmDiagnosis: (id: string) => void
  retryStage: (id: string) => void
  retryDiagnosis: () => void
  markNeedsReview: (id: string) => void
  updateDraft: (id: string, value: string) => void
  generateReport: () => void
  setStages: React.Dispatch<React.SetStateAction<Stage[]>>
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setDiagnosisResults: React.Dispatch<React.SetStateAction<Record<string, DiagnosisResult>>>
}

export type StageContextValue = StageState & StageActions
