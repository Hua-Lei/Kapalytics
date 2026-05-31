import { LlmProvider, LlmRequest } from '../types'

export const deepseekProvider: LlmProvider = {
  name: 'DeepSeek',
  model: 'deepseek-v4-pro',
  endpoint: 'https://api.deepseek.com/v1/chat/completions',

  buildHeaders(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  },

  buildBody(request: LlmRequest, model: string) {
    const systemMsg = request.messages.find((m) => m.role === 'system')
    const chatMessages = request.messages.filter((m) => m.role !== 'system')
    const body: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      messages: [
        ...(systemMsg ? [{ role: 'system', content: systemMsg.content }] : []),
        ...chatMessages.map((m) => ({ role: m.role, content: m.content }))
      ]
    }
    if (request.jsonMode) {
      body.response_format = { type: 'json_object' }
      body.thinking = { type: request.thinking ?? 'disabled' }
    } else if (request.thinking) {
      body.thinking = { type: request.thinking }
    }
    if (request.reasoningEffort) {
      body.reasoning_effort = request.reasoningEffort
    }
    return body
  },

  parseResponse(data: any) {
    const choice = data.choices?.[0]
    return {
      content: choice?.message?.content ?? '',
      finishReason: choice?.finish_reason,
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined
    }
  }
}
