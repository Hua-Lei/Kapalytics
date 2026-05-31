# Retrieval Settings Design

## Goal

Add a settings workflow that verifies whether the paper retrieval stack works in the same way node expansion uses it. The user should be able to run one aggregated search test, see provider-level status, and optionally configure a Semantic Scholar API key once it is available.

## Scope

The first version adds a complete aggregated retrieval test, not separate per-provider diagnostic tools. It reuses the existing retrieval implementation so the settings test reflects the real expansion path.

## User Experience

The settings modal gains a `论文检索测试` section.

- It shows an editable query input, defaulting to `hypernetwork meta-learning`.
- `测试检索` runs a live search.
- The result shows total candidate count, provider statuses, and up to three returned paper titles with their sources.
- Provider rows use existing `providerStatus` states: `success`, `empty`, and `error`.
- Semantic Scholar 429 errors should be shown with a hint that public shared quota may be limited and an API key can be configured later.

The settings modal also gains an optional `Semantic Scholar API Key` field.

- Empty is valid.
- When absent, Semantic Scholar still uses the public API and may return 429.
- When present, retrieval calls send it as `x-api-key`.
- The UI only indicates whether a key is configured; it does not display the stored secret.

## Architecture

Store retrieval provider configuration alongside the current persisted LLM configuration unless the existing file becomes awkward. The minimal shape is:

```ts
interface LlmConfig {
  proxyUrl: string | null
  semanticScholarApiKeyConfigured: boolean
}
```

The actual Semantic Scholar key should be persisted securely enough for the current app model, using the same local userData storage pattern and restrictive file permissions already used for the DeepSeek key. The public config returned to the renderer must expose only the configured boolean.

Add main-process helpers:

- `setSemanticScholarApiKey(key: string)`
- `clearSemanticScholarApiKey()`
- `hasSemanticScholarApiKey()`
- `getSemanticScholarApiKey()` for retrieval only

Add IPC methods under the existing `llm` namespace for config management, and a separate retrieval test IPC:

- `llm:set-semantic-scholar-api-key`
- `llm:clear-semantic-scholar-api-key`
- `retrieval:test-search`

`retrieval:test-search` calls `searchPapers` with:

```ts
{
  query,
  searchQueries: [query],
  maxResults: 5,
  requireAbstract: true
}
```

It returns:

```ts
interface RetrievalConnectionTestResult {
  ok: boolean
  query: string
  candidateCount: number
  providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }>
  samplePapers: Array<{ title: string; sources: string[]; year?: number }>
  message: string
}
```

## Data Flow

1. User opens settings.
2. Renderer loads config and sees whether DeepSeek and Semantic Scholar keys are configured.
3. User optionally saves or clears the Semantic Scholar key.
4. User runs a retrieval test query.
5. Main process executes the normal retrieval stack.
6. Renderer displays provider status and sample papers.

## Error Handling

The retrieval test should almost never throw to the renderer. `searchPapers` already captures per-provider failures, so the IPC should return `ok: false` only when all providers fail or no candidates are usable. Provider errors remain visible in `providerStatus`.

If the IPC itself fails unexpectedly, the renderer shows a generic failure message and leaves any previous settings intact.

## Testing

Add focused tests for:

- Semantic Scholar key config does not expose the secret in `getLlmConfig`.
- Retrieval test result maps `searchPapers` output into `candidateCount`, `providerStatus`, and `samplePapers`.
- Existing `paperSearch` tests continue to verify abstract filtering and provider configuration.

Manual verification should run the settings test with a known query and confirm OpenAlex works, arXiv either works or reports its own timeout, and Semantic Scholar reports success or a clear 429/key-needed message.
