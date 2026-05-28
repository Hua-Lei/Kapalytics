export type { DiagnosisResult } from '../../../../shared/electron-api'

export type ErrorType =
  | 'field_misclassification'
  | 'concept_confusion'
  | 'method_flow_error'
  | 'formula_misunderstanding'
  | 'experiment_misinterpretation'
  | 'contribution_misjudgement'
  | 'transfer_insufficient'
