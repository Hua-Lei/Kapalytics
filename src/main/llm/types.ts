export type LLMModel = 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'deepseek-chat' | 'deepseek-reasoner'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  messages: LlmMessage[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  jsonMode?: boolean
  model?: LLMModel
  thinking?: 'enabled' | 'disabled'
  reasoningEffort?: 'high' | 'max'
}

export interface LlmResponse {
  content: string
  finishReason?: string
  usage?: { inputTokens: number; outputTokens: number }
}

export interface LlmProvider {
  name: string
  model: string
  endpoint: string
  buildHeaders: (apiKey: string) => Record<string, string>
  buildBody: (request: LlmRequest, model: string) => unknown
  parseResponse: (data: unknown) => LlmResponse
}
