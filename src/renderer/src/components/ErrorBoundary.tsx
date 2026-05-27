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
            background: '#1a1a2e',
            color: '#eaeaea',
            fontFamily: 'system-ui, sans-serif'
          }}
        >
          <div style={{ maxWidth: 500, textAlign: 'center', padding: 32 }}>
            <h2 style={{ color: '#e94560', marginBottom: 12 }}>应用遇到了问题</h2>
            <p style={{ color: '#888', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
              {this.state.error?.message ?? '未知渲染错误'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              style={{
                padding: '8px 24px',
                background: '#e94560',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              重新加载
            </button>
            <p style={{ color: '#555', fontSize: 12, marginTop: 20 }}>
              如果问题持续出现，请尝试清除本地存储数据：
              <br />
              <code style={{ background: '#16213e', padding: '2px 6px', borderRadius: 3 }}>
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
