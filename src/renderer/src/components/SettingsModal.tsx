import { useState } from 'react'

interface SettingsModalProps {
  open: boolean
  hasApiConfigured: boolean
  onClose: () => void
  onSaveKey: (key: string) => void
  onClearKey: () => void
  onTestConnection: () => Promise<boolean>
}

function SettingsModal({
  open,
  hasApiConfigured,
  onClose,
  onSaveKey,
  onClearKey,
  onTestConnection
}: SettingsModalProps) {
  const [keyInput, setKeyInput] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle')

  if (!open) return null

  const handleTest = async () => {
    setTesting(true)
    setTestResult('idle')
    const ok = await onTestConnection()
    setTestResult(ok ? 'success' : 'fail')
    setTesting(false)
  }

  const handleSave = async () => {
    if (keyInput.trim()) {
      await onSaveKey(keyInput.trim())
      setKeyInput('')
      setTestResult('idle')
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
              <span className="modal__value">DeepSeek (deepseek-v4-flash)</span>
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
                <span className="modal__status modal__status--ok">连接成功</span>
              )}
              {testResult === 'fail' && (
                <span className="modal__status modal__status--err">连接失败</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
