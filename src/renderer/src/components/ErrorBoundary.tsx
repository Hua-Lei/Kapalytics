import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg-app, #f6f4ef)',
            color: 'var(--color-text, #24211d)',
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <div style={{ maxWidth: 500, textAlign: 'center', padding: 32 }}>
            <h2 style={{ color: 'var(--color-danger, #a14a43)', marginBottom: 12 }}>应用遇到了问题</h2>
            <p style={{ color: 'var(--color-text-muted, #625d55)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              {this.state.error?.message ?? '未知渲染错误'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              style={{
                padding: '8px 24px',
                background: 'var(--color-accent, #315c72)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              重新加载
            </button>
            <p style={{ color: 'var(--color-text-tertiary, #8b8378)', fontSize: 12, marginTop: 20 }}>
              如果问题持续出现，请尝试清除本地存储数据：
              <br />
              <code style={{ background: 'var(--color-bg-muted, #f0eee8)', padding: '2px 6px', borderRadius: 3 }}>
                rm -rf ~/.config/kapalytics/saves/
              </code>
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
