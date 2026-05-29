import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import 'katex/dist/katex.min.css'
import './index.css'
import './App.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/panels.css'
import './styles/controls.css'
import './styles/pdf.css'
import './styles/graph.css'
import './styles/learning.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
