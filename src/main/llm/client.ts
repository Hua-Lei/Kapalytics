import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { app } from 'electron'
import { LlmProvider, LlmRequest, LlmResponse } from './types'
import { deepseekProvider } from './providers/deepseek'

let currentProvider: LlmProvider = deepseekProvider
let apiKey: string | null = null

function getApiKeyPath(): string {
  return `${app.getPath('userData')}/api-key.txt`
}

function readPersistedApiKey(): string | null {
  try {
    const path = getApiKeyPath()
    if (!existsSync(path)) return null
    const key = readFileSync(path, 'utf-8').trim()
    return key.length > 0 ? key : null
  } catch {
    return null
  }
}

function persistApiKey(key: string): void {
  const path = getApiKeyPath()
  if (!existsSync(dirname(path))) return
  writeFileSync(path, key, { encoding: 'utf-8', mode: 0o600 })
}

function removePersistedApiKey(): void {
  try {
    const path = getApiKeyPath()
    if (existsSync(path)) unlinkSync(path)
  } catch {
    // Clearing in-memory key is still enough for the current session.
  }
}

export function setProvider(provider: LlmProvider): void {
  currentProvider = provider
}

export function getProvider(): LlmProvider {
  return currentProvider
}

export function setApiKey(key: string): void {
  apiKey = key
  persistApiKey(key)
}

export function clearApiKey(): void {
  apiKey = null
  removePersistedApiKey()
}

export function hasApiKey(): boolean {
  if (!apiKey) apiKey = readPersistedApiKey()
  return apiKey !== null && apiKey.length > 0
}

export function getAvailableProviders(): { name: string; id: string }[] {
  return [{ name: 'DeepSeek', id: 'deepseek' }]
  // Add more: { name: 'Anthropic Claude', id: 'anthropic' }, { name: 'OpenAI', id: 'openai' }
}

export async function callLlm(request: LlmRequest): Promise<LlmResponse> {
  if (!apiKey) apiKey = readPersistedApiKey()
  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }

  const provider = currentProvider
  const body = provider.buildBody(request, provider.model)
  const controller = new AbortController()
  const timeoutMs = request.timeoutMs ?? 90000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

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
      throw new Error(`TIMEOUT:请求超时（${Math.round(timeoutMs / 1000)}s）`)
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
