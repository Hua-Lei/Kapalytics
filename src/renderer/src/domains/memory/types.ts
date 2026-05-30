import type { NodeUnderstandingMemory } from '../../../../shared/kg4'

export interface MemoryState {
  memories: NodeUnderstandingMemory[]
  loading: boolean
}

export interface MemoryActions {
  loadMemories: () => Promise<void>
  saveMemory: (memory: NodeUnderstandingMemory) => Promise<void>
  selectMemory: (memory: NodeUnderstandingMemory) => void
  setMemories: React.Dispatch<React.SetStateAction<NodeUnderstandingMemory[]>>
}

export type MemoryContextValue = MemoryState & MemoryActions
