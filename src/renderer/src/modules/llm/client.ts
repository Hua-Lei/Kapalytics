import { LlmRequest, LlmResponse } from './types'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

function getApiKey(): string | null {
  try {
    const stored = localStorage.getItem('kapalytics_api_key')
    if (stored) return stored
  } catch {
    // localStorage may not be available
  }
  return null
}

export function setApiKey(key: string): void {
  localStorage.setItem('kapalytics_api_key', key)
}

export function clearApiKey(): void {
  localStorage.removeItem('kapalytics_api_key')
}

export function hasApiKey(): boolean {
  return getApiKey() !== null
}

export async function callLlm(request: LlmRequest): Promise<LlmResponse> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('未配置 API Key。请在设置中输入 Anthropic API Key。')
  }

  // Convert our generic format to Anthropic API format
  const systemMsg = request.messages.find((m) => m.role === 'system')
  const chatMessages = request.messages.filter((m) => m.role !== 'system')

  const body = {
    model: request.model,
    max_tokens: request.maxTokens ?? 2048,
    temperature: request.temperature ?? 0.7,
    system: systemMsg?.content,
    messages: chatMessages.map((m) => ({
      role: m.role,
      content: m.content
    }))
  }

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API 调用失败 (${res.status}): ${err}`)
  }

  const data = await res.json()
  return {
    content: data.content[0]?.text ?? '',
    usage: data.usage
      ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
      : undefined
  }
}
