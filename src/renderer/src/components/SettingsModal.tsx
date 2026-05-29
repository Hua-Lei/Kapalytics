import { useEffect, useState } from 'react'

interface SettingsModalProps {
  open: boolean
  hasApiConfigured: boolean
  initialProxyUrl: string
  onClose: () => void
  onSaveKey: (key: string) => Promise<void>
  onSaveProxyUrl: (proxyUrl: string | null) => Promise<void>
  onClearKey: () => void
  onTestConnection: () => Promise<{ ok: boolean; message: string }>
}

function SettingsModal({
  open,
  hasApiConfigured,
  initialProxyUrl,
  onClose,
  onSaveKey,
  onSaveProxyUrl,
  onClearKey,
  onTestConnection
}: SettingsModalProps) {
  const [keyInput, setKeyInput] = useState('')
  const [proxyInput, setProxyInput] = useState(initialProxyUrl)
  const [testing, setTesting] = useState(false)
  const [savingProxy, setSavingProxy] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

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
