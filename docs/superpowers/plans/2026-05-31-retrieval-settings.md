# Retrieval Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add settings support for optional Semantic Scholar API key storage and a live aggregated paper retrieval test.

**Architecture:** Keep retrieval behavior in the main process and expose a small typed IPC surface to the renderer. Reuse `searchPapers` for the test path so settings reflects the real expansion retrieval stack. Store the Semantic Scholar key locally like the existing DeepSeek key, but only expose a configured boolean to the renderer.

**Tech Stack:** Electron main/preload IPC, TypeScript, React, existing `searchPapers`, existing node `assert` + `tsx` tests.

---

## File Structure

- Modify `src/main/llm/client.ts`: add Semantic Scholar key persistence helpers and include `semanticScholarApiKeyConfigured` in public config.
- Modify `src/main/retrieval/paperSearch.ts`: read the Semantic Scholar key from `client.ts` instead of only `process.env`.
- Create `src/main/retrieval/retrievalTest.ts`: convert a search query into a settings-friendly test result.
- Create `src/main/retrieval/retrievalTest.test.ts`: cover result mapping and success/failure status.
- Modify `src/main/index.ts`: add IPC handlers for key management and retrieval test.
- Modify `src/shared/electron-api.ts`: add typed config/result fields and IPC methods.
- Modify `src/preload/index.ts`: expose retrieval test and Semantic Scholar key methods.
- Modify `src/renderer/src/modules/ipc/electronApi.ts`: add renderer convenience wrappers.
- Modify `src/renderer/src/App.tsx`: load updated config and pass callbacks into settings.
- Modify `src/renderer/src/components/SettingsModal.tsx`: add Semantic Scholar key controls and retrieval test UI.

---

### Task 1: Semantic Scholar Key Config

**Files:**
- Modify: `src/main/llm/client.ts`
- Test indirectly with: `npm run typecheck`

- [ ] **Step 1: Add key path and persistence helpers**

In `src/main/llm/client.ts`, add a separate in-memory key and persistence path next to the existing DeepSeek API key state:

```ts
let semanticScholarApiKey: string | null = null

function getSemanticScholarApiKeyPath(): string {
  return `${app.getPath('userData')}/semantic-scholar-api-key.txt`
}

function readPersistedSemanticScholarApiKey(): string | null {
  try {
    const path = getSemanticScholarApiKeyPath()
    if (!existsSync(path)) return null
    const key = readFileSync(path, 'utf-8').trim()
    return key.length > 0 ? key : null
  } catch {
    return null
  }
}

function persistSemanticScholarApiKey(key: string): void {
  const path = getSemanticScholarApiKeyPath()
  if (!existsSync(dirname(path))) return
  writeFileSync(path, key, { encoding: 'utf-8', mode: 0o600 })
}

function removePersistedSemanticScholarApiKey(): void {
  try {
    const path = getSemanticScholarApiKeyPath()
    if (existsSync(path)) unlinkSync(path)
  } catch {
    // Clearing in-memory key is still enough for the current session.
  }
}
```

- [ ] **Step 2: Export key management functions**

Add these exports after the existing `hasApiKey` function:

```ts
export function setSemanticScholarApiKey(key: string): void {
  semanticScholarApiKey = key
  persistSemanticScholarApiKey(key)
}

export function clearSemanticScholarApiKey(): void {
  semanticScholarApiKey = null
  removePersistedSemanticScholarApiKey()
}

export function hasSemanticScholarApiKey(): boolean {
  if (!semanticScholarApiKey) semanticScholarApiKey = readPersistedSemanticScholarApiKey()
  return semanticScholarApiKey !== null && semanticScholarApiKey.length > 0
}

export function getSemanticScholarApiKey(): string | null {
  if (!semanticScholarApiKey) semanticScholarApiKey = readPersistedSemanticScholarApiKey()
  return semanticScholarApiKey
}
```

- [ ] **Step 3: Extend public config without exposing the secret**

Change `getLlmConfig` to return the configured boolean:

```ts
export function getLlmConfig(): { proxyUrl: string | null; semanticScholarApiKeyConfigured: boolean } {
  return { ...getLoadedLlmConfig(), semanticScholarApiKeyConfigured: hasSemanticScholarApiKey() }
}
```

- [ ] **Step 4: Run typecheck to find type updates needed later**

Run: `npm run typecheck`

Expected: FAIL until shared renderer types are updated in later tasks.

---

### Task 2: Retrieval Test Result Mapper

**Files:**
- Create: `src/main/retrieval/retrievalTest.ts`
- Create: `src/main/retrieval/retrievalTest.test.ts`

- [ ] **Step 1: Write the failing mapper test**

Create `src/main/retrieval/retrievalTest.test.ts`:

```ts
import assert from 'node:assert/strict'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import { toRetrievalConnectionTestResult } from './retrievalTest'

function candidate(title: string, sources: string[], year?: number): DedupedPaperCandidate {
  return {
    canonicalId: title.toLowerCase().replace(/\s+/g, '-'),
    mergedFrom: [],
    title,
    authors: [],
    year,
    sources,
    externalIds: [],
    bestUrl: `https://example.test/${encodeURIComponent(title)}`,
    abstract: 'abstract',
    score: 1
  }
}

const success = toRetrievalConnectionTestResult({
  query: 'hypernetwork meta-learning',
  candidates: [
    candidate('HyperNetworks', ['arxiv', 'openalex'], 2016),
    candidate('Meta Learning Survey', ['openalex'], 2021),
    candidate('Third Paper', ['semantic_scholar']),
    candidate('Fourth Paper', ['openalex'])
  ],
  providerStatus: [
    { provider: 'openalex', status: 'success', message: '找到 5 篇可验证论文' },
    { provider: 'arxiv', status: 'empty', message: 'arXiv 暂无结果或未启用' }
  ]
})

assert.equal(success.ok, true)
assert.equal(success.candidateCount, 4)
assert.equal(success.samplePapers.length, 3)
assert.equal(success.samplePapers[0].title, 'HyperNetworks')
assert.deepEqual(success.samplePapers[0].sources, ['arxiv', 'openalex'])

const failure = toRetrievalConnectionTestResult({
  query: 'hypernetwork meta-learning',
  candidates: [],
  providerStatus: [
    { provider: 'openalex', status: 'error', message: 'NETWORK_ERROR' },
    { provider: 'semantic_scholar', status: 'error', message: 'Semantic Scholar API 429' }
  ]
})

assert.equal(failure.ok, false)
assert.match(failure.message, /未检索到可用论文/)
assert.match(failure.providerStatus[1].message, /429/)

console.log('retrievalTest tests passed')
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `npx tsx src/main/retrieval/retrievalTest.test.ts`

Expected: FAIL because `./retrievalTest` does not exist.

- [ ] **Step 3: Implement the mapper**

Create `src/main/retrieval/retrievalTest.ts`:

```ts
import type { DedupedPaperCandidate } from '../../shared/kg3'

export interface RetrievalConnectionTestResult {
  ok: boolean
  query: string
  candidateCount: number
  providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }>
  samplePapers: Array<{ title: string; sources: string[]; year?: number }>
  message: string
}

export function toRetrievalConnectionTestResult(params: {
  query: string
  candidates: DedupedPaperCandidate[]
  providerStatus: RetrievalConnectionTestResult['providerStatus']
}): RetrievalConnectionTestResult {
  const candidateCount = params.candidates.length
  const successProviders = params.providerStatus.filter((status) => status.status === 'success').length
  return {
    ok: candidateCount > 0,
    query: params.query,
    candidateCount,
    providerStatus: params.providerStatus,
    samplePapers: params.candidates.slice(0, 3).map((paper) => ({
      title: paper.title,
      sources: paper.sources,
      year: paper.year
    })),
    message: candidateCount > 0
      ? `检索完成：${successProviders} 个来源返回可用结果，共 ${candidateCount} 篇候选论文。`
      : '未检索到可用论文，请检查网络、代理或 provider API Key。'
  }
}
```

- [ ] **Step 4: Run mapper test and verify it passes**

Run: `npx tsx src/main/retrieval/retrievalTest.test.ts`

Expected: PASS with `retrievalTest tests passed`.

---

### Task 3: Main Process Retrieval IPC

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/retrieval/paperSearch.ts`

- [ ] **Step 1: Make paperSearch use stored Semantic Scholar key**

In `src/main/retrieval/paperSearch.ts`, update imports:

```ts
import { getLlmConfig, getSemanticScholarApiKey } from '../llm/client'
```

Then replace the current Semantic Scholar API key line with:

```ts
const apiKey = getSemanticScholarApiKey() ?? process.env.SEMANTIC_SCHOLAR_API_KEY?.trim()
```

- [ ] **Step 2: Add main-process imports**

In `src/main/index.ts`, extend the `./llm/client` import to include:

```ts
setSemanticScholarApiKey,
clearSemanticScholarApiKey
```

Add retrieval test import:

```ts
import { toRetrievalConnectionTestResult } from './retrieval/retrievalTest'
```

- [ ] **Step 3: Add Semantic Scholar key IPC handlers**

After `llm:set-proxy-url`, add:

```ts
ipcMain.handle('llm:set-semantic-scholar-api-key', (_e, key: string) => {
  setSemanticScholarApiKey(key.trim())
})

ipcMain.handle('llm:clear-semantic-scholar-api-key', () => {
  clearSemanticScholarApiKey()
})
```

- [ ] **Step 4: Add retrieval test IPC handler**

After `kg3:search-papers`, add:

```ts
ipcMain.handle('retrieval:test-search', async (_e, rawQuery: unknown) => {
  const query = typeof rawQuery === 'string' && rawQuery.trim() ? rawQuery.trim() : 'hypernetwork meta-learning'
  const { candidates, providerStatus } = await searchPapers({
    query,
    searchQueries: [query],
    maxResults: 5,
    requireAbstract: true
  })
  return toRetrievalConnectionTestResult({ query, candidates, providerStatus })
})
```

- [ ] **Step 5: Run tests**

Run: `npx tsx src/main/retrieval/retrievalTest.test.ts && npx tsx src/main/retrieval/paperSearch.test.ts`

Expected: PASS for both tests.

---

### Task 4: Shared and Preload Types

**Files:**
- Modify: `src/shared/electron-api.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/modules/ipc/electronApi.ts`

- [ ] **Step 1: Extend shared API types**

In `src/shared/electron-api.ts`, change `LlmConfig` to:

```ts
export interface LlmConfig {
  proxyUrl: string | null
  semanticScholarApiKeyConfigured: boolean
}
```

Add:

```ts
export interface RetrievalConnectionTestResult {
  ok: boolean
  query: string
  candidateCount: number
  providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }>
  samplePapers: Array<{ title: string; sources: string[]; year?: number }>
  message: string
}
```

Add to `ElectronApi.llm`:

```ts
setSemanticScholarApiKey: (key: string) => Promise<void>
clearSemanticScholarApiKey: () => Promise<void>
```

Add to `ElectronApi` top level:

```ts
retrieval: {
  testSearch: (query: string) => Promise<RetrievalConnectionTestResult>
}
```

- [ ] **Step 2: Expose preload methods**

In `src/preload/index.ts`, add under `llm`:

```ts
setSemanticScholarApiKey: (key: string): Promise<void> => ipcRenderer.invoke('llm:set-semantic-scholar-api-key', key),
clearSemanticScholarApiKey: (): Promise<void> => ipcRenderer.invoke('llm:clear-semantic-scholar-api-key'),
```

Add a top-level `retrieval` object:

```ts
retrieval: {
  testSearch: (query: string) => ipcRenderer.invoke('retrieval:test-search', query)
}
```

- [ ] **Step 3: Update renderer wrapper**

In `src/renderer/src/modules/ipc/electronApi.ts`, update fallback config:

```ts
getApi()?.llm?.getConfig?.().catch(() => ({ proxyUrl: null, semanticScholarApiKeyConfigured: false })) ?? Promise.resolve({ proxyUrl: null, semanticScholarApiKeyConfigured: false })
```

Add wrappers:

```ts
setSemanticScholarApiKey: (key: string) => getApi()?.llm?.setSemanticScholarApiKey?.(key) ?? Promise.resolve(),
clearSemanticScholarApiKey: () => getApi()?.llm?.clearSemanticScholarApiKey?.() ?? Promise.resolve(),
testRetrieval: (query: string) => getApi()?.retrieval?.testSearch?.(query) ?? Promise.resolve({
  ok: false,
  query,
  candidateCount: 0,
  providerStatus: [],
  samplePapers: [],
  message: 'Retrieval API unavailable'
}),
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: FAIL until UI props are updated in Task 5.

---

### Task 5: Settings UI

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/SettingsModal.tsx`

- [ ] **Step 1: Extend SettingsModal props and state**

In `SettingsModal.tsx`, update props:

```ts
interface SettingsModalProps {
  open: boolean
  hasApiConfigured: boolean
  semanticScholarApiKeyConfigured: boolean
  initialProxyUrl: string
  onClose: () => void
  onSaveKey: (key: string) => Promise<void>
  onSaveSemanticScholarKey: (key: string) => Promise<void>
  onSaveProxyUrl: (proxyUrl: string | null) => Promise<void>
  onClearKey: () => void
  onClearSemanticScholarKey: () => Promise<void>
  onTestConnection: () => Promise<{ ok: boolean; message: string }>
  onTestRetrieval: (query: string) => Promise<{
    ok: boolean
    query: string
    candidateCount: number
    providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }>
    samplePapers: Array<{ title: string; sources: string[]; year?: number }>
    message: string
  }>
}
```

Add state:

```ts
const [semanticScholarKeyInput, setSemanticScholarKeyInput] = useState('')
const [retrievalQuery, setRetrievalQuery] = useState('hypernetwork meta-learning')
const [testingRetrieval, setTestingRetrieval] = useState(false)
const [retrievalResult, setRetrievalResult] = useState<Awaited<ReturnType<SettingsModalProps['onTestRetrieval']>> | null>(null)
```

- [ ] **Step 2: Add handlers**

Add inside `SettingsModal`:

```ts
const handleSaveSemanticScholarKey = async () => {
  if (!semanticScholarKeyInput.trim()) return
  await onSaveSemanticScholarKey(semanticScholarKeyInput.trim())
  setSemanticScholarKeyInput('')
  setTestResult('success')
  setTestMessage('Semantic Scholar API Key 已保存')
}

const handleTestRetrieval = async () => {
  setTestingRetrieval(true)
  setRetrievalResult(null)
  try {
    setRetrievalResult(await onTestRetrieval(retrievalQuery.trim() || 'hypernetwork meta-learning'))
  } finally {
    setTestingRetrieval(false)
  }
}
```

- [ ] **Step 3: Add Semantic Scholar key UI**

Add this section after the DeepSeek API section:

```tsx
<section className="modal__section">
  <h3 className="modal__section-title">论文检索 API 配置</h3>
  <div className="modal__field">
    <label className="modal__label">Semantic Scholar API Key（可选）</label>
    <input
      type="password"
      className="modal__input"
      placeholder={semanticScholarApiKeyConfigured ? '已配置 (●●●●)' : '申请后可填写，未配置也会尝试公共接口'}
      value={semanticScholarKeyInput}
      onChange={(e) => setSemanticScholarKeyInput(e.target.value)}
    />
  </div>
  <p className="modal__hint">未配置时会使用公共接口，可能遇到 429 共享限流；申请到 Key 后填入可提高稳定性。</p>
  <div className="modal__actions">
    <button className="modal__btn modal__btn--secondary" onClick={handleSaveSemanticScholarKey}>保存 Semantic Scholar Key</button>
    {semanticScholarApiKeyConfigured && (
      <button className="modal__btn modal__btn--ghost" onClick={onClearSemanticScholarKey}>清除 Semantic Scholar Key</button>
    )}
  </div>
</section>
```

- [ ] **Step 4: Add retrieval test UI**

Add this section before the existing connection test section:

```tsx
<section className="modal__section">
  <h3 className="modal__section-title">论文检索测试</h3>
  <div className="modal__field">
    <label className="modal__label">测试查询</label>
    <input
      type="text"
      className="modal__input"
      value={retrievalQuery}
      onChange={(e) => setRetrievalQuery(e.target.value)}
    />
  </div>
  <div className="modal__actions">
    <button className="modal__btn modal__btn--secondary" onClick={handleTestRetrieval} disabled={testingRetrieval}>
      {testingRetrieval ? '检索中...' : '测试检索'}
    </button>
    {retrievalResult && (
      <span className={`modal__status ${retrievalResult.ok ? 'modal__status--ok' : 'modal__status--err'}`}>{retrievalResult.message}</span>
    )}
  </div>
  {retrievalResult && (
    <div className="modal__hint">
      <div>候选论文：{retrievalResult.candidateCount}</div>
      {retrievalResult.providerStatus.map((status) => (
        <div key={status.provider}>{status.provider}: {status.status} - {status.message}</div>
      ))}
      {retrievalResult.samplePapers.map((paper) => (
        <div key={paper.title}>{paper.title}{paper.year ? ` (${paper.year})` : ''} - {paper.sources.join(', ')}</div>
      ))}
    </div>
  )}
</section>
```

- [ ] **Step 5: Wire App state and callbacks**

In `App.tsx`, add state:

```ts
const [semanticScholarApiKeyConfigured, setSemanticScholarApiKeyConfigured] = useState(false)
```

Where config loads, set both fields:

```ts
electronApi.getLlmConfig().then((config) => {
  setProxyUrl(config.proxyUrl ?? '')
  setSemanticScholarApiKeyConfigured(config.semanticScholarApiKeyConfigured)
}).catch(() => {})
```

Pass props to `SettingsModal`:

```tsx
semanticScholarApiKeyConfigured={semanticScholarApiKeyConfigured}
onSaveSemanticScholarKey={async (key) => {
  await electronApi.setSemanticScholarApiKey(key)
  setSemanticScholarApiKeyConfigured(true)
}}
onClearSemanticScholarKey={async () => {
  await electronApi.clearSemanticScholarApiKey()
  setSemanticScholarApiKeyConfigured(false)
}}
onTestRetrieval={electronApi.testRetrieval}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

---

### Task 6: Verification and Commit

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run focused tests**

Run: `npx tsx src/main/retrieval/retrievalTest.test.ts && npx tsx src/main/retrieval/paperSearch.test.ts`

Expected: PASS for both tests.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Review diff**

Run: `git diff -- src/main/llm/client.ts src/main/retrieval/paperSearch.ts src/main/retrieval/retrievalTest.ts src/main/retrieval/retrievalTest.test.ts src/main/index.ts src/shared/electron-api.ts src/preload/index.ts src/renderer/src/modules/ipc/electronApi.ts src/renderer/src/App.tsx src/renderer/src/components/SettingsModal.tsx`

Expected: diff only contains retrieval settings changes.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/main/llm/client.ts src/main/retrieval/paperSearch.ts src/main/retrieval/retrievalTest.ts src/main/retrieval/retrievalTest.test.ts src/main/index.ts src/shared/electron-api.ts src/preload/index.ts src/renderer/src/modules/ipc/electronApi.ts src/renderer/src/App.tsx src/renderer/src/components/SettingsModal.tsx
git commit -m "feat(settings): add retrieval test controls"
```

Expected: commit succeeds without staging unrelated docs deletions or unrelated working-tree changes.
