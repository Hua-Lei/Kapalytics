export type NodeType = 'field' | 'concept' | 'problem' | 'method' | 'formula' | 'experiment' | 'limitation'

export interface GraphNode {
  id: string
  type: NodeType
  label: string
  description: string
  x: number
  y: number
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  label?: string
  directed: boolean
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
