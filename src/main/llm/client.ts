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
    throw new Error('NO_API_KEY')
  }

  const provider = currentProvider
  const body = provider.buildBody(request, provider.model)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000)

  try {
    const res = await fetch(provider.endpoint, {
      method: 'POST',
      headers: provider.buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`API_ERROR:${res.status}:${errText.slice(0, 200)}`)
    }

    const data = await res.json()
    return provider.parseResponse(data)
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('TIMEOUT:请求超时（30s）')
    }
    if (err instanceof Error && err.message.startsWith('API_ERROR:')) {
      throw err
    }
    if (err instanceof Error && err.message === 'NO_API_KEY') {
      throw err
    }
    throw new Error(`NETWORK_ERROR:${String(err)}`)
  } finally {
    clearTimeout(timeout)
  }
}
