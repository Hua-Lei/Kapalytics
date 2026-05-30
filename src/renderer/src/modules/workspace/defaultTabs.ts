import type { WorkspaceTab } from './types'

export const defaultWorkspaceTabs: WorkspaceTab[] = [
  { id: 'pdf_reader', type: 'pdf_reader', title: 'PDF Reader', closable: false, status: 'idle' },
  { id: 'paper_graph', type: 'paper_graph', title: 'Paper Graph', closable: false, status: 'idle' },
  { id: 'argument_chain', type: 'argument_chain', title: 'Argument Chain', closable: false, status: 'idle' },
  { id: 'method_mechanism', type: 'method_mechanism', title: 'Method Mechanism', closable: false, status: 'idle' },
  { id: 'stage_learning', type: 'stage_learning', title: 'Stage Learning', closable: false, status: 'idle' },
  { id: 'field_memory', type: 'field_memory', title: 'Field Memory', closable: false, status: 'idle' }
]
