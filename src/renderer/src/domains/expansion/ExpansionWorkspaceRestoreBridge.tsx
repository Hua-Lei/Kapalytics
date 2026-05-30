import { useEffect, useRef } from 'react'
import { createReadySessionFromRecord } from './nodeExpansionSessions'
import { useExpansion } from './useExpansion'
import { usePaper } from '../paper/usePaper'
import { useWorkspace } from '../workspace/useWorkspace'
import { electronApi } from '../../modules/ipc/electronApi'

const RESTORABLE_TAB_TYPES = new Set(['node_expansion_loading', 'expansion_graph', 'expand_view'])

export function ExpansionWorkspaceRestoreBridge() {
  const { sessions, setSessions } = useExpansion()
  const { graph, paperId } = usePaper()
  const { state } = useWorkspace()
  const attemptedKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const tabsToRestore = state.tabs.filter(
      (tab) => RESTORABLE_TAB_TYPES.has(tab.type) && tab.nodeId && tab.expansionId && !sessions[tab.expansionId]
    )

    if (!paperId || tabsToRestore.length === 0) return

    let cancelled = false

    void Promise.all(
      tabsToRestore.map(async (tab) => {
        const nodeId = tab.nodeId
        const expansionId = tab.expansionId
        if (!nodeId || !expansionId) return

        const node = graph.nodes.find((graphNode) => graphNode.id === nodeId)
        if (!node) return

        const attemptKey = `${paperId}:${nodeId}:${expansionId}`
        if (attemptedKeysRef.current.has(attemptKey)) return
        attemptedKeysRef.current.add(attemptKey)

        const record = await electronApi.kg4.getExpansionRecord({ paperId, nodeId })
        if (!record || cancelled) return

        const restoredSession = createReadySessionFromRecord(record, node)
        setSessions((prev) => {
          if (prev[expansionId]) return prev
          return {
            ...prev,
            [expansionId]: {
              ...restoredSession,
              id: expansionId
            }
          }
        })
      })
    )

    return () => {
      cancelled = true
    }
  }, [graph.nodes, paperId, sessions, setSessions, state.tabs])

  return null
}
