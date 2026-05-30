import { useEffect, useRef } from 'react'
import { electronApi } from '../../modules/ipc/electronApi'
import type { SavePayload } from './types'

export function usePersistence(payload: SavePayload, hydrated: boolean) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!hydrated) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      electronApi.save(payload)
    }, 500)
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [payload, hydrated])
}
