import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const expandViewSource = readFileSync(new URL('../../components/ExpandView.tsx', import.meta.url), 'utf8')
const fieldMemorySource = readFileSync(new URL('../../components/FieldMemoryView.tsx', import.meta.url), 'utf8')

assert.match(expandViewSource, /useMemories/)
assert.match(expandViewSource, /persistMemory\(memory\)/)
assert.doesNotMatch(expandViewSource, /electronApi\.kg4\.saveNodeUnderstandingMemory\(memory\)/)

assert.match(fieldMemorySource, /useEffect/)
assert.match(fieldMemorySource, /loadMemories\(\)/)

console.log('memory wiring tests passed')
