export type ErrorType =
  | 'field_misclassification'
  | 'concept_confusion'
  | 'method_flow_error'
  | 'formula_misunderstanding'
  | 'experiment_misinterpretation'
  | 'contribution_misjudgement'
  | 'transfer_insufficient'

export interface DiagnosisResult {
  errorType: string
  isCorrect: boolean
  feedback: string
  remedialTask: string
}
