export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  model: string
  messages: LlmMessage[]
  maxTokens?: number
  temperature?: number
}

export interface LlmResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export type AiRole = 'knowledge_graph' | 'stage_task' | 'diagnosis'

export interface AiGenerateRequest {
  role: AiRole
  paperContext: string
  stageId?: string
  userAnswer?: string
}
