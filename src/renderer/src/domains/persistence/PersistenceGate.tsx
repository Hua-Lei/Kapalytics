import { useEffect, useState, type ReactNode } from 'react'
import { electronApi } from '../../modules/ipc/electronApi'

interface PersistenceGateProps {
  children: ReactNode
  onLoad: (data: Record<string, unknown>) => void
}

export function PersistenceGate({ children, onLoad }: PersistenceGateProps) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    electronApi.load()
      .then((saved) => {
        if (saved && typeof saved === 'object') {
          onLoad(saved as Record<string, unknown>)
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  if (!hydrated) {
    return (
      <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="workspace-placeholder-view" style={{ textAlign: 'center' }}>
          <h2>Kapalytics</h2>
          <p>Loading saved state...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
