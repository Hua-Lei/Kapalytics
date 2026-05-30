import { useContext } from 'react'
import { PaperContext } from './PaperProvider'
import type { PaperContextValue } from './types'

export function usePaper(): PaperContextValue {
  const ctx = useContext(PaperContext)
  if (!ctx) throw new Error('usePaper must be used within PaperProvider')
  return ctx
}
