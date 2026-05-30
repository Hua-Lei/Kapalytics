import { useContext } from 'react'
import { ExpansionContext } from './ExpansionProvider'
import type { ExpansionContextValue } from './types'

export function useExpansion(): ExpansionContextValue {
  const ctx = useContext(ExpansionContext)
  if (!ctx) throw new Error('useExpansion must be used within ExpansionProvider')
  return ctx
}
