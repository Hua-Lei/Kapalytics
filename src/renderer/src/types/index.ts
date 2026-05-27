export type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'needs_review'

export interface Stage {
  id: string
  order: number
  name: string
  status: StageStatus
  mastery: number
  description: string
  task: string
}
