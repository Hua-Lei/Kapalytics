import { LlmProvider, LlmRequest, LlmResponse } from './types'
import { deepseekProvider } from './providers/deepseek'

let currentProvider: LlmProvider = deepseekProvider
let apiKey: string | null = null

export function setProvider(provider: LlmProvider): void {
  currentProvider = provider
}

export function getProvider(): LlmProvider {
  return currentProvider
}

export function setApiKey(key: string): void {
  apiKey = key
}

export function clearApiKey(): void {
  apiKey = null
}

export function hasApiKey(): boolean {
  return apiKey !== null && apiKey.length > 0
}

export function getAvailableProviders(): { name: string; id: string }[] {
  return [{ name: 'DeepSeek', id: 'deepseek' }]
  // Add more: { name: 'Anthropic Claude', id: 'anthropic' }, { name: 'OpenAI', id: 'openai' }
}

export async function callLlm(request: LlmRequest): Promise<LlmResponse> {
  if (!apiKey) {
    throw new Error('API Key 未配置')
  }

  const provider = currentProvider
  const body = provider.buildBody(request, provider.model)

  const res = await fetch(provider.endpoint, {
    method: 'POST',
    headers: provider.buildHeaders(apiKey),
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API 调用失败 (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return provider.parseResponse(data)
}
