import { useEffect, useState } from 'react'

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

function SettingsModal({
  open,
  hasApiConfigured,
  semanticScholarApiKeyConfigured,
  initialProxyUrl,
  onClose,
  onSaveKey,
  onSaveSemanticScholarKey,
  onSaveProxyUrl,
  onClearKey,
  onClearSemanticScholarKey,
  onTestConnection,
  onTestRetrieval
}: SettingsModalProps) {
  const [keyInput, setKeyInput] = useState('')
  const [semanticScholarKeyInput, setSemanticScholarKeyInput] = useState('')
  const [proxyInput, setProxyInput] = useState(initialProxyUrl)
  const [retrievalQuery, setRetrievalQuery] = useState('hypernetwork meta-learning')
  const [testing, setTesting] = useState(false)
  const [testingRetrieval, setTestingRetrieval] = useState(false)
  const [savingProxy, setSavingProxy] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [retrievalResult, setRetrievalResult] = useState<Awaited<ReturnType<SettingsModalProps['onTestRetrieval']>> | null>(null)

  useEffect(() => {
    if (open) setProxyInput(initialProxyUrl)
  }, [initialProxyUrl, open])

  if (!open) return null

  const handleTest = async () => {
    setTesting(true)
    setTestResult('idle')
    const result = await onTestConnection()
    setTestResult(result.ok ? 'success' : 'fail')
    setTestMessage(result.message)
    setTesting(false)
  }

  const handleSave = async () => {
    if (keyInput.trim()) {
      await onSaveKey(keyInput.trim())
      setKeyInput('')
      setTestResult('idle')
      setTestMessage('')
    }
  }

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

  const handleSaveProxy = async () => {
    setSavingProxy(true)
    setTestResult('idle')
    setTestMessage('')
    try {
      await onSaveProxyUrl(proxyInput.trim() || null)
      setTestResult('success')
      setTestMessage('代理设置已保存')
    } catch (err) {
      setTestResult('fail')
      setTestMessage(err instanceof Error ? err.message : '代理保存失败')
    } finally {
      setSavingProxy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">设置</h2>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal__body">
          <section className="modal__section">
            <h3 className="modal__section-title">API 配置</h3>
            <div className="modal__field">
              <label className="modal__label">服务商</label>
              <span className="modal__value">DeepSeek (deepseek-v4-pro)</span>
            </div>
            <div className="modal__field">
              <label className="modal__label">API Key</label>
              <input
                type="password"
                className="modal__input"
                placeholder={hasApiConfigured ? '已配置 (●●●●)' : 'sk-...'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
            </div>
            <div className="modal__actions">
              <button className="modal__btn modal__btn--primary" onClick={handleSave}>
                保存
              </button>
              {hasApiConfigured && (
                <button className="modal__btn modal__btn--secondary" onClick={onClearKey}>
                  清除 Key
                </button>
              )}
            </div>
          </section>

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
            <p className="modal__hint">
              未配置时会使用公共接口，可能遇到 429 共享限流；申请到 Key 后填入可提高稳定性。
            </p>
            <div className="modal__actions">
              <button className="modal__btn modal__btn--secondary" onClick={handleSaveSemanticScholarKey}>
                保存 Semantic Scholar Key
              </button>
              {semanticScholarApiKeyConfigured && (
                <button className="modal__btn modal__btn--ghost" onClick={onClearSemanticScholarKey}>
                  清除 Semantic Scholar Key
                </button>
              )}
            </div>
          </section>

          <section className="modal__section">
            <h3 className="modal__section-title">代理设置</h3>
            <div className="modal__field">
              <label className="modal__label">HTTP / HTTPS 代理</label>
              <input
                type="text"
                className="modal__input"
                placeholder="http://127.0.0.1:7890"
                value={proxyInput}
                onChange={(e) => setProxyInput(e.target.value)}
              />
            </div>
            <p className="modal__hint">
              当当前网络无法直连 DeepSeek 时，可在此配置代理地址。仅支持 `http://` 或 `https://` 开头。
            </p>
            <div className="modal__actions">
              <button className="modal__btn modal__btn--secondary" onClick={handleSaveProxy} disabled={savingProxy}>
                {savingProxy ? '保存中...' : '保存代理'}
              </button>
              <button
                className="modal__btn modal__btn--ghost"
                onClick={() => setProxyInput('')}
                disabled={savingProxy}
              >
                清空输入
              </button>
            </div>
          </section>

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
                <span className={`modal__status ${retrievalResult.ok ? 'modal__status--ok' : 'modal__status--err'}`}>
                  {retrievalResult.message}
                </span>
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

          <section className="modal__section">
            <h3 className="modal__section-title">连接测试</h3>
            <div className="modal__actions">
              <button
                className="modal__btn modal__btn--secondary"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              {testResult === 'success' && (
                <span className="modal__status modal__status--ok">{testMessage || '连接成功'}</span>
              )}
              {testResult === 'fail' && (
                <span className="modal__status modal__status--err">{testMessage || '连接失败'}</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
