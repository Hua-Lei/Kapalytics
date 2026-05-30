import { useContext } from 'react'
import { WorkspaceContext } from './WorkspaceProvider'
import type { WorkspaceContextValue } from './WorkspaceProvider'

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
