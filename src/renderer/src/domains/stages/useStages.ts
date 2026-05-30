import { useContext } from 'react'
import { StageContext } from './StageProvider'
import type { StageContextValue } from './types'

export function useStages(): StageContextValue {
  const ctx = useContext(StageContext)
  if (!ctx) throw new Error('useStages must be used within StageProvider')
  return ctx
}
