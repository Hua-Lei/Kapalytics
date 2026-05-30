import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { electronApi } from '../../modules/ipc/electronApi'
import type { NodeUnderstandingMemory } from '../../../../shared/kg4'
import type { MemoryContextValue } from './types'

export const MemoryContext = createContext<MemoryContextValue | null>(null)

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<NodeUnderstandingMemory[]>([])
  const [loading, setLoading] = useState(false)

  const loadMemories = useCallback(async () => {
    setLoading(true)
    try {
      const result = await electronApi.kg4.listNodeUnderstandingMemories({ limit: 100 })
      setMemories(result)
    } catch {
      setMemories([])
    } finally {
      setLoading(false)
    }
  }, [])

  const saveMemory = useCallback(async (memory: NodeUnderstandingMemory) => {
    await electronApi.kg4.saveNodeUnderstandingMemory(memory)
    await loadMemories()
  }, [loadMemories])

  const selectMemory = useCallback((_memory: NodeUnderstandingMemory) => {
    // The consumer component wires this with useWorkspace().selectObject()
  }, [])

  useEffect(() => { loadMemories() }, [loadMemories])

  return (
    <MemoryContext.Provider value={{ memories, loading, loadMemories, saveMemory, selectMemory, setMemories }}>
      {children}
    </MemoryContext.Provider>
  )
}
