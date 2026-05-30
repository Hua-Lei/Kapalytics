import { useContext } from 'react'
import { MemoryContext } from './MemoryProvider'
import type { MemoryContextValue } from './types'

export function useMemories(): MemoryContextValue {
  const ctx = useContext(MemoryContext)
  if (!ctx) throw new Error('useMemories must be used within MemoryProvider')
  return ctx
}
