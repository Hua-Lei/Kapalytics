import type { NodeUnderstandingMemory } from '../../../../shared/kg4'

interface MemoryPersistenceDependencies {
  save: (memory: NodeUnderstandingMemory) => Promise<{ ok: boolean }>
  reload: () => Promise<void>
}

export async function saveMemoryAndRefresh(
  memory: NodeUnderstandingMemory,
  dependencies: MemoryPersistenceDependencies
): Promise<void> {
  const result = await dependencies.save(memory)
  if (!result.ok) throw new Error('保存失败：KG4 IPC 不可用。')
  await dependencies.reload()
}
