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
}

export interface LlmResponse {
  content: string
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
