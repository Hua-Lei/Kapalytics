import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { app } from 'electron'
import { ProxyAgent } from 'undici'
import { LlmProvider, LlmRequest, LlmResponse } from './types'
import { deepseekProvider } from './providers/deepseek'

let currentProvider: LlmProvider = deepseekProvider
let apiKey: string | null = null
let llmConfig: { proxyUrl: string | null } | null = null

function getApiKeyPath(): string {
  return `${app.getPath('userData')}/api-key.txt`
}

function getLlmConfigPath(): string {
  return `${app.getPath('userData')}/llm-config.json`
}

function readPersistedLlmConfig(): { proxyUrl: string | null } {
  try {
    const path = getLlmConfigPath()
    if (!existsSync(path)) return { proxyUrl: null }
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as { proxyUrl?: unknown }
    return { proxyUrl: typeof parsed.proxyUrl === 'string' && parsed.proxyUrl.trim() ? parsed.proxyUrl.trim() : null }
  } catch {
    return { proxyUrl: null }
  }
}

function persistLlmConfig(config: { proxyUrl: string | null }): void {
  const path = getLlmConfigPath()
  if (!existsSync(dirname(path))) return
  writeFileSync(path, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 })
}

function getLoadedLlmConfig(): { proxyUrl: string | null } {
  if (!llmConfig) llmConfig = readPersistedLlmConfig()
  return llmConfig
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

export function getLlmConfig(): { proxyUrl: string | null } {
  return { ...getLoadedLlmConfig() }
}

export function setProxyUrl(proxyUrl: string | null): void {
  const value = proxyUrl?.trim() || null
  if (value) {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('INVALID_PROXY_URL:代理地址必须以 http:// 或 https:// 开头')
    }
  }
  llmConfig = { ...getLoadedLlmConfig(), proxyUrl: value }
  persistLlmConfig(llmConfig)
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
  const body = provider.buildBody(request, request.model ?? provider.model)
  const controller = new AbortController()
  const timeoutMs = request.timeoutMs ?? 90000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const proxyUrl = getLoadedLlmConfig().proxyUrl

  try {
    const init: RequestInit & { dispatcher?: ProxyAgent } = {
      method: 'POST',
      headers: provider.buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal
    }
    if (proxyUrl) init.dispatcher = new ProxyAgent(proxyUrl)

    const res = await fetch(provider.endpoint, init)
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`API_ERROR:${res.status}:${errText.slice(0, 200)}`)
    }

    const data = await res.json()
    return provider.parseResponse(data)
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`TIMEOUT:请求超时（${Math.round(timeoutMs / 1000)}s）。请稍后重试，或在设置中配置可用代理。`)
    }
    if (err instanceof Error && err.message.startsWith('API_ERROR:')) {
      throw err
    }
    if (err instanceof Error && err.message === 'NO_API_KEY') {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    if (proxyUrl) {
      throw new Error(`NETWORK_ERROR:无法通过代理连接 DeepSeek：${message}`)
    }
    throw new Error(`NETWORK_ERROR:无法连接 DeepSeek：${message}。如果当前网络无法直连，请在设置中配置 HTTP/HTTPS 代理。`)
  } finally {
    clearTimeout(timeout)
  }
}
