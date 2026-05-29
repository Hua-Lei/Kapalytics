import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { dirname, join } from 'path'
import Database from 'better-sqlite3'
import type { Database as BetterSqliteDatabase } from 'better-sqlite3'
import type { GraphEdge, GraphNode, PaperInsight } from '../../shared/paper'
import type {
  DiagnosisRecord,
  GraphEdgeRecord,
  GraphNodeRecord,
  Kg3MemorySnapshot,
  LearningTaskRecord,
  LLMJob,
  MergedGraphEdge,
  MergedGraphNode,
  NodeExpansionRecord,
  PaperInsightRecord,
  PaperMemoryRepository,
  PaperRecord,
  PaperSearchResult,
  PaperSearchResultRecord,
  ReadingSession,
  UserMasteryRecord
} from '../../shared/kg3'
import type { MemoryReuseSuggestion, NodeUnderstandingMemory, NodeUnderstandingMemoryQuery } from '../../shared/kg4'
import { normalizeKg4NodeLabel } from '../../shared/kg4'

const EMPTY_SNAPSHOT: Kg3MemorySnapshot = {
  papers: [],
  paperInsights: [],
  graphNodes: [],
  graphEdges: [],
  readingSessions: [],
  learningTasks: [],
  diagnoses: [],
  nodeExpansions: [],
  paperSearchResults: [],
  mergedGraphNodes: [],
  mergedGraphEdges: [],
  userMastery: [],
  llmJobs: [],
  nodeUnderstandingMemories: []
}

function now(): string {
  return new Date().toISOString()
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ').trim()
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 16)}`
}

function readSnapshot(path: string): Kg3MemorySnapshot {
  try {
    if (!existsSync(path)) return { ...EMPTY_SNAPSHOT }
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<Kg3MemorySnapshot>
    return { ...EMPTY_SNAPSHOT, ...parsed }
  } catch {
    return { ...EMPTY_SNAPSHOT }
  }
}

function writeSnapshot(path: string, snapshot: Kg3MemorySnapshot): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(snapshot, null, 2), 'utf-8')
}

function upsertById<T extends { id: string }>(records: T[], record: T): T[] {
  const index = records.findIndex((item) => item.id === record.id)
  if (index === -1) return [...records, record]
  return records.map((item, itemIndex) => (itemIndex === index ? record : item))
}

type JsonTableName =
  | 'papers'
  | 'paper_insights'
  | 'graph_nodes'
  | 'graph_edges'
  | 'reading_sessions'
  | 'learning_tasks'
  | 'diagnoses'
  | 'node_expansions'
  | 'paper_search_results'
  | 'merged_graph_nodes'
  | 'merged_graph_edges'
  | 'user_mastery'
  | 'llm_jobs'
  | 'node_understanding_memories'

const JSON_TABLES: JsonTableName[] = [
  'papers',
  'paper_insights',
  'graph_nodes',
  'graph_edges',
  'reading_sessions',
  'learning_tasks',
  'diagnoses',
  'node_expansions',
  'paper_search_results',
  'merged_graph_nodes',
  'merged_graph_edges',
  'user_mastery',
  'llm_jobs',
  'node_understanding_memories'
]

const SNAPSHOT_KEYS: Record<JsonTableName, keyof Kg3MemorySnapshot> = {
  papers: 'papers',
  paper_insights: 'paperInsights',
  graph_nodes: 'graphNodes',
  graph_edges: 'graphEdges',
  reading_sessions: 'readingSessions',
  learning_tasks: 'learningTasks',
  diagnoses: 'diagnoses',
  node_expansions: 'nodeExpansions',
  paper_search_results: 'paperSearchResults',
  merged_graph_nodes: 'mergedGraphNodes',
  merged_graph_edges: 'mergedGraphEdges',
  user_mastery: 'userMastery',
  llm_jobs: 'llmJobs',
  node_understanding_memories: 'nodeUnderstandingMemories'
}

type JsonRow = { json: string }

function mapEvidenceChainToNodeIds(insight: PaperInsight, nodeRecords: GraphNodeRecord[]): {
  evidenceChainNodeIds: string[]
  evidenceChainLabels: string[]
} {
  const labelToRecordId = new Map(nodeRecords.map((node) => [node.label, node.id]))
  const idToRecordId = new Map(nodeRecords.map((node) => [node.id.split(':').at(-1) ?? node.id, node.id]))
  const evidenceChainNodeIds: string[] = []
  const evidenceChainLabels: string[] = []

  for (const item of insight.evidenceChain) {
    const recordId = labelToRecordId.get(item) ?? idToRecordId.get(item)
    if (recordId) {
      evidenceChainNodeIds.push(recordId)
    } else {
      evidenceChainLabels.push(item)
    }
  }

  return { evidenceChainNodeIds: [...new Set(evidenceChainNodeIds)], evidenceChainLabels }
}

export class FilePaperMemoryRepository implements PaperMemoryRepository {
  private readonly configuredPath?: string

  constructor(path?: string) {
    this.configuredPath = path
  }

  private get path(): string {
    return this.configuredPath ?? join(app.getPath('userData'), 'memory', 'kg3-memory.json')
  }

  async savePaper(record: PaperRecord): Promise<void> {
    const snapshot = readSnapshot(this.path)
    snapshot.papers = upsertById(snapshot.papers, { ...record, updatedAt: now() })
    writeSnapshot(this.path, snapshot)
  }

  async getPaper(id: string): Promise<PaperRecord | null> {
    return readSnapshot(this.path).papers.find((paper) => paper.id === id) ?? null
  }

  async listPapers(): Promise<PaperRecord[]> {
    return readSnapshot(this.path).papers
  }

  async saveGraphForPaper(
    paperId: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    insight?: PaperInsight
  ): Promise<void> {
    const snapshot = readSnapshot(this.path)
    const timestamp = now()

    snapshot.graphNodes = snapshot.graphNodes.filter((node) => node.paperId !== paperId)
    snapshot.graphEdges = snapshot.graphEdges.filter((edge) => edge.paperId !== paperId)

    const nodeRecords: GraphNodeRecord[] = nodes.map((node) => ({
      id: `${paperId}:${node.id}`,
      paperId,
      nodeType: node.type,
      label: node.label,
      normalizedLabel: normalizeLabel(node.label),
      description: node.description,
      insight: node.insight,
      whyImportant: node.whyImportant,
      roleInPaper: node.roleInPaper,
      contrastWithPrior: node.contrastWithPrior,
      evidenceNodeIds: node.evidenceNodeIds ?? [],
      expandable: Boolean(node.expandable),
      expansionType: node.expansionType,
      searchQueries: node.searchQueries ?? [],
      detailJson: node.detail,
      confidence: 0.72,
      createdAt: timestamp,
      updatedAt: timestamp
    }))

    const edgeRecords: GraphEdgeRecord[] = edges.map((edge) => ({
      id: `${paperId}:${edge.id}`,
      paperId,
      sourceNodeId: `${paperId}:${edge.sourceId}`,
      targetNodeId: `${paperId}:${edge.targetId}`,
      relationType: inferRelationType(edge.label),
      label: edge.label ?? 'related',
      directed: edge.directed,
      confidence: 0.68,
      createdAt: timestamp,
      updatedAt: timestamp
    }))

    snapshot.graphNodes.push(...nodeRecords)
    snapshot.graphEdges.push(...edgeRecords)

    if (insight) {
      const evidence = mapEvidenceChainToNodeIds(insight, nodeRecords)
      const insightRecord: PaperInsightRecord = {
        id: `${paperId}:insight`,
        paperId,
        ...insight,
        evidenceChainNodeIds: evidence.evidenceChainNodeIds,
        evidenceChainLabels: evidence.evidenceChainLabels,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      snapshot.paperInsights = upsertById(snapshot.paperInsights, insightRecord)
    }

    writeSnapshot(this.path, snapshot)
  }

  async saveSearchResults(query: string, results: PaperSearchResult[]): Promise<void> {
    const snapshot = readSnapshot(this.path)
    const timestamp = now()
    const records: PaperSearchResultRecord[] = results.map((result) => ({
      ...result,
      id: stableId('search', `${result.provider}:${result.externalId}`),
      query,
      cacheKey: stableId('cache', `${result.provider}:${query}:${result.externalId}`),
      fetchedAt: result.fetchedAt || timestamp
    }))
    for (const record of records) snapshot.paperSearchResults = upsertById(snapshot.paperSearchResults, record)
    writeSnapshot(this.path, snapshot)
  }

  async saveNodeExpansion(record: NodeExpansionRecord): Promise<void> {
    const snapshot = readSnapshot(this.path)
    snapshot.nodeExpansions = upsertById(snapshot.nodeExpansions, { ...record, updatedAt: now() })
    writeSnapshot(this.path, snapshot)
  }

  async saveLLMJob(job: LLMJob): Promise<void> {
    const snapshot = readSnapshot(this.path)
    snapshot.llmJobs = upsertById(snapshot.llmJobs, job)
    writeSnapshot(this.path, snapshot)
  }

  async saveNodeUnderstandingMemory(record: NodeUnderstandingMemory): Promise<void> {
    const snapshot = readSnapshot(this.path)
    snapshot.nodeUnderstandingMemories = upsertById(snapshot.nodeUnderstandingMemories, { ...record, updatedAt: now() })
    writeSnapshot(this.path, snapshot)
  }

  async listNodeUnderstandingMemories(query: NodeUnderstandingMemoryQuery = {}): Promise<NodeUnderstandingMemory[]> {
    return filterNodeUnderstandingMemories(readSnapshot(this.path).nodeUnderstandingMemories, query)
  }

  async findReusableNodeMemories(params: {
    node: GraphNodeRecord
    topicTags: string[]
    methodFamilyTags: string[]
    limit?: number
  }): Promise<MemoryReuseSuggestion[]> {
    return buildMemoryReuseSuggestions(readSnapshot(this.path).nodeUnderstandingMemories, params)
  }

  async getSnapshot(): Promise<Kg3MemorySnapshot> {
    return readSnapshot(this.path)
  }

  async saveSnapshot(snapshot: Kg3MemorySnapshot): Promise<void> {
    writeSnapshot(this.path, snapshot)
  }
}

export class SqlitePaperMemoryRepository implements PaperMemoryRepository {
  private readonly db: BetterSqliteDatabase

  constructor(path = join(app.getPath('userData'), 'kapalytics.sqlite')) {
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.db = new Database(path)
    this.initialize()
  }

  async savePaper(record: PaperRecord): Promise<void> {
    this.upsertJson('papers', { ...record, updatedAt: now() })
  }

  async getPaper(id: string): Promise<PaperRecord | null> {
    return this.getJsonById<PaperRecord>('papers', id)
  }

  async listPapers(): Promise<PaperRecord[]> {
    return this.allJson<PaperRecord>('papers')
  }

  async saveGraphForPaper(
    paperId: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    insight?: PaperInsight
  ): Promise<void> {
    const timestamp = now()
    const nodeRecords: GraphNodeRecord[] = nodes.map((node) => ({
      id: `${paperId}:${node.id}`,
      paperId,
      nodeType: node.type,
      label: node.label,
      normalizedLabel: normalizeLabel(node.label),
      description: node.description,
      insight: node.insight,
      whyImportant: node.whyImportant,
      roleInPaper: node.roleInPaper,
      contrastWithPrior: node.contrastWithPrior,
      evidenceNodeIds: node.evidenceNodeIds ?? [],
      expandable: Boolean(node.expandable),
      expansionType: node.expansionType,
      searchQueries: node.searchQueries ?? [],
      detailJson: node.detail,
      confidence: 0.72,
      createdAt: timestamp,
      updatedAt: timestamp
    }))
    const edgeRecords: GraphEdgeRecord[] = edges.map((edge) => ({
      id: `${paperId}:${edge.id}`,
      paperId,
      sourceNodeId: `${paperId}:${edge.sourceId}`,
      targetNodeId: `${paperId}:${edge.targetId}`,
      relationType: inferRelationType(edge.label),
      label: edge.label ?? 'related',
      directed: edge.directed,
      confidence: 0.68,
      createdAt: timestamp,
      updatedAt: timestamp
    }))

    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM graph_nodes WHERE paper_id = ?').run(paperId)
      this.db.prepare('DELETE FROM graph_edges WHERE paper_id = ?').run(paperId)
      nodeRecords.forEach((record) => this.upsertJson('graph_nodes', record, { paperId: record.paperId, normalizedLabel: record.normalizedLabel, nodeType: record.nodeType }))
      edgeRecords.forEach((record) => this.upsertJson('graph_edges', record, { paperId: record.paperId, sourceNodeId: record.sourceNodeId, targetNodeId: record.targetNodeId }))

      if (insight) {
        const evidence = mapEvidenceChainToNodeIds(insight, nodeRecords)
        const insightRecord: PaperInsightRecord = {
          id: `${paperId}:insight`,
          paperId,
          ...insight,
          evidenceChainNodeIds: evidence.evidenceChainNodeIds,
          evidenceChainLabels: evidence.evidenceChainLabels,
          createdAt: timestamp,
          updatedAt: timestamp
        }
        this.upsertJson('paper_insights', insightRecord, { paperId })
      }
    })
    tx()
  }

  async saveSearchResults(query: string, results: PaperSearchResult[]): Promise<void> {
    const timestamp = now()
    for (const result of results) {
      const record: PaperSearchResultRecord = {
        ...result,
        id: stableId('search', `${result.provider}:${result.externalId}`),
        query,
        cacheKey: stableId('cache', `${result.provider}:${query}:${result.externalId}`),
        fetchedAt: result.fetchedAt || timestamp
      }
      this.upsertJson('paper_search_results', record, { provider: record.provider, externalId: record.externalId, cacheKey: record.cacheKey })
    }
  }

  async saveNodeExpansion(record: NodeExpansionRecord): Promise<void> {
    this.upsertJson('node_expansions', { ...record, updatedAt: now() }, { paperId: record.paperId, nodeId: record.nodeId })
  }

  async saveLLMJob(job: LLMJob): Promise<void> {
    this.upsertJson('llm_jobs', job, { paperId: job.paperId, nodeId: job.nodeId, status: job.status, jobType: job.type })
  }

  async saveNodeUnderstandingMemory(record: NodeUnderstandingMemory): Promise<void> {
    const next = { ...record, updatedAt: now() }
    this.upsertJson('node_understanding_memories', next, {
      nodeId: next.nodeId,
      sourcePaperId: next.sourcePaperId,
      normalizedNodeLabel: next.normalizedNodeLabel,
      nodeType: next.nodeType
    })
  }

  async listNodeUnderstandingMemories(query: NodeUnderstandingMemoryQuery = {}): Promise<NodeUnderstandingMemory[]> {
    return filterNodeUnderstandingMemories(this.allJson<NodeUnderstandingMemory>('node_understanding_memories'), query)
  }

  async findReusableNodeMemories(params: {
    node: GraphNodeRecord
    topicTags: string[]
    methodFamilyTags: string[]
    limit?: number
  }): Promise<MemoryReuseSuggestion[]> {
    return buildMemoryReuseSuggestions(this.allJson<NodeUnderstandingMemory>('node_understanding_memories'), params)
  }

  async getSnapshot(): Promise<Kg3MemorySnapshot> {
    return {
      papers: this.allJson<PaperRecord>('papers'),
      paperInsights: this.allJson<PaperInsightRecord>('paper_insights'),
      graphNodes: this.allJson<GraphNodeRecord>('graph_nodes'),
      graphEdges: this.allJson<GraphEdgeRecord>('graph_edges'),
      readingSessions: this.allJson<ReadingSession>('reading_sessions'),
      learningTasks: this.allJson<LearningTaskRecord>('learning_tasks'),
      diagnoses: this.allJson<DiagnosisRecord>('diagnoses'),
      nodeExpansions: this.allJson<NodeExpansionRecord>('node_expansions'),
      paperSearchResults: this.allJson<PaperSearchResultRecord>('paper_search_results'),
      mergedGraphNodes: this.allJson<MergedGraphNode>('merged_graph_nodes'),
      mergedGraphEdges: this.allJson<MergedGraphEdge>('merged_graph_edges'),
      userMastery: this.allJson<UserMasteryRecord>('user_mastery'),
      llmJobs: this.allJson<LLMJob>('llm_jobs'),
      nodeUnderstandingMemories: this.allJson<NodeUnderstandingMemory>('node_understanding_memories')
    }
  }

  async saveSnapshot(snapshot: Kg3MemorySnapshot): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const table of JSON_TABLES) this.db.prepare(`DELETE FROM ${table}`).run()
      this.insertSnapshotRows('papers', snapshot.papers)
      this.insertSnapshotRows('paper_insights', snapshot.paperInsights, (record) => ({ paperId: record.paperId }))
      this.insertSnapshotRows('graph_nodes', snapshot.graphNodes, (record) => ({ paperId: record.paperId, normalizedLabel: record.normalizedLabel, nodeType: record.nodeType }))
      this.insertSnapshotRows('graph_edges', snapshot.graphEdges, (record) => ({ paperId: record.paperId, sourceNodeId: record.sourceNodeId, targetNodeId: record.targetNodeId }))
      this.insertSnapshotRows('reading_sessions', snapshot.readingSessions, (record) => ({ paperId: record.paperId }))
      this.insertSnapshotRows('learning_tasks', snapshot.learningTasks, (record) => ({ paperId: record.paperId, nodeId: record.nodeId }))
      this.insertSnapshotRows('diagnoses', snapshot.diagnoses, (record) => ({ paperId: record.paperId, nodeId: record.nodeId, taskId: record.taskId }))
      this.insertSnapshotRows('node_expansions', snapshot.nodeExpansions, (record) => ({ paperId: record.paperId, nodeId: record.nodeId }))
      this.insertSnapshotRows('paper_search_results', snapshot.paperSearchResults, (record) => ({ provider: record.provider, externalId: record.externalId, cacheKey: record.cacheKey }))
      this.insertSnapshotRows('merged_graph_nodes', snapshot.mergedGraphNodes, (record) => ({ normalizedLabel: record.normalizedLabel, nodeType: record.nodeType }))
      this.insertSnapshotRows('merged_graph_edges', snapshot.mergedGraphEdges, (record) => ({ sourceMergedNodeId: record.sourceMergedNodeId, targetMergedNodeId: record.targetMergedNodeId }))
      this.insertSnapshotRows('user_mastery', snapshot.userMastery, (record) => ({ targetType: record.targetType, targetId: record.targetId }))
      this.insertSnapshotRows('llm_jobs', snapshot.llmJobs, (record) => ({ paperId: record.paperId, nodeId: record.nodeId, status: record.status, jobType: record.type }))
      this.insertSnapshotRows('node_understanding_memories', snapshot.nodeUnderstandingMemories, (record) => ({
        nodeId: record.nodeId,
        sourcePaperId: record.sourcePaperId,
        normalizedNodeLabel: record.normalizedNodeLabel,
        nodeType: record.nodeType
      }))
    })
    tx()
  }

  private initialize(): void {
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS papers (id TEXT PRIMARY KEY, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS paper_external_ids (paper_id TEXT NOT NULL, provider TEXT NOT NULL, external_id TEXT NOT NULL, url TEXT, PRIMARY KEY (provider, external_id));
      CREATE TABLE IF NOT EXISTS paper_insights (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS graph_nodes (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, normalized_label TEXT NOT NULL, node_type TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS graph_edges (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, source_node_id TEXT NOT NULL, target_node_id TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS reading_sessions (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS learning_tasks (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, node_id TEXT, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS diagnoses (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, node_id TEXT, task_id TEXT, json TEXT NOT NULL, created_at TEXT);
      CREATE TABLE IF NOT EXISTS node_expansions (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, node_id TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS paper_search_results (id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_id TEXT NOT NULL, cache_key TEXT NOT NULL, json TEXT NOT NULL, fetched_at TEXT, expires_at TEXT);
      CREATE TABLE IF NOT EXISTS merged_graph_nodes (id TEXT PRIMARY KEY, normalized_label TEXT NOT NULL, node_type TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS merged_graph_edges (id TEXT PRIMARY KEY, source_merged_node_id TEXT NOT NULL, target_merged_node_id TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS user_mastery (id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, json TEXT NOT NULL, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS llm_jobs (id TEXT PRIMARY KEY, job_type TEXT NOT NULL, status TEXT NOT NULL, paper_id TEXT, node_id TEXT, cache_key TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, finished_at TEXT);
      CREATE TABLE IF NOT EXISTS node_understanding_memories (id TEXT PRIMARY KEY, node_id TEXT NOT NULL, source_paper_id TEXT NOT NULL, normalized_node_label TEXT NOT NULL, node_type TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);

      CREATE INDEX IF NOT EXISTS idx_papers_updated_at ON papers(updated_at);
      CREATE INDEX IF NOT EXISTS idx_paper_insights_paper_id ON paper_insights(paper_id);
      CREATE INDEX IF NOT EXISTS idx_graph_nodes_paper_label ON graph_nodes(paper_id, normalized_label);
      CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(node_type);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_paper_pair ON graph_edges(paper_id, source_node_id, target_node_id);
      CREATE INDEX IF NOT EXISTS idx_diagnoses_task_id ON diagnoses(task_id);
      CREATE INDEX IF NOT EXISTS idx_diagnoses_node_id ON diagnoses(node_id);
      CREATE INDEX IF NOT EXISTS idx_paper_search_provider_external ON paper_search_results(provider, external_id);
      CREATE INDEX IF NOT EXISTS idx_paper_search_cache_key ON paper_search_results(cache_key);
      CREATE INDEX IF NOT EXISTS idx_merged_nodes_label ON merged_graph_nodes(normalized_label);
      CREATE INDEX IF NOT EXISTS idx_user_mastery_target ON user_mastery(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_llm_jobs_type_status ON llm_jobs(job_type, status);
      CREATE INDEX IF NOT EXISTS idx_node_memory_label ON node_understanding_memories(normalized_node_label);
      CREATE INDEX IF NOT EXISTS idx_node_memory_type ON node_understanding_memories(node_type);
      CREATE INDEX IF NOT EXISTS idx_node_memory_source_paper ON node_understanding_memories(source_paper_id);
      CREATE INDEX IF NOT EXISTS idx_node_memory_updated ON node_understanding_memories(updated_at);
    `)
    this.db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(1, now())
  }

  private upsertJson<T extends { id: string; createdAt?: string; updatedAt?: string; fetchedAt?: string; finishedAt?: string }>(
    table: JsonTableName,
    record: T,
    indexes: Record<string, string | number | boolean | null | undefined> = {}
  ): void {
    this.insertSnapshotRows(table, [record], () => indexes)
    if (table === 'papers') this.upsertPaperExternalIds(record as unknown as PaperRecord)
  }

  private insertSnapshotRows<T extends { id: string; createdAt?: string; updatedAt?: string; fetchedAt?: string; finishedAt?: string }>(
    table: JsonTableName,
    records: T[],
    indexes: (record: T) => Record<string, string | number | boolean | null | undefined> = () => ({})
  ): void {
    const statement = insertStatementForTable(this.db, table)
    for (const record of records) {
      const rowIndexes = indexes(record)
      statement.run(...paramsForTable(table, record, rowIndexes))
      if (table === 'papers') this.upsertPaperExternalIds(record as unknown as PaperRecord)
    }
  }

  private getJsonById<T>(table: JsonTableName, id: string): T | null {
    const row = this.db.prepare(`SELECT json FROM ${table} WHERE id = ?`).get(id) as JsonRow | undefined
    return row ? JSON.parse(row.json) as T : null
  }

  private allJson<T>(table: JsonTableName): T[] {
    return this.db.prepare<[], JsonRow>(`SELECT json FROM ${table}`).all().map((row) => JSON.parse(row.json) as T)
  }

  private upsertPaperExternalIds(record: PaperRecord): void {
    const statement = this.db.prepare('INSERT OR REPLACE INTO paper_external_ids (paper_id, provider, external_id, url) VALUES (?, ?, ?, ?)')
    for (const external of record.externalIds) statement.run(record.id, external.provider, external.externalId, external.url ?? null)
  }
}

function inferRelationType(label: string | undefined): GraphEdgeRecord['relationType'] {
  const text = label ?? ''
  if (/动机|motiv/i.test(text)) return 'motivates'
  if (/解决|solve/i.test(text)) return 'solves'
  if (/使用|use|依赖/i.test(text)) return 'uses'
  if (/验证|valid/i.test(text)) return 'validates'
  if (/限制|limit/i.test(text)) return 'limits'
  if (/对比|contrast/i.test(text)) return 'contrasts'
  if (/扩展|extend/i.test(text)) return 'extends'
  if (/推导|derive/i.test(text)) return 'derives'
  return 'related'
}

function insertStatementForTable(db: BetterSqliteDatabase, table: JsonTableName) {
  switch (table) {
    case 'papers':
      return db.prepare('INSERT OR REPLACE INTO papers (id, json, created_at, updated_at) VALUES (?, ?, ?, ?)')
    case 'paper_insights':
      return db.prepare('INSERT OR REPLACE INTO paper_insights (id, paper_id, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    case 'graph_nodes':
      return db.prepare('INSERT OR REPLACE INTO graph_nodes (id, paper_id, normalized_label, node_type, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    case 'graph_edges':
      return db.prepare('INSERT OR REPLACE INTO graph_edges (id, paper_id, source_node_id, target_node_id, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    case 'reading_sessions':
      return db.prepare('INSERT OR REPLACE INTO reading_sessions (id, paper_id, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    case 'learning_tasks':
      return db.prepare('INSERT OR REPLACE INTO learning_tasks (id, paper_id, node_id, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    case 'diagnoses':
      return db.prepare('INSERT OR REPLACE INTO diagnoses (id, paper_id, node_id, task_id, json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    case 'node_expansions':
      return db.prepare('INSERT OR REPLACE INTO node_expansions (id, paper_id, node_id, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    case 'paper_search_results':
      return db.prepare('INSERT OR REPLACE INTO paper_search_results (id, provider, external_id, cache_key, json, fetched_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    case 'merged_graph_nodes':
      return db.prepare('INSERT OR REPLACE INTO merged_graph_nodes (id, normalized_label, node_type, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    case 'merged_graph_edges':
      return db.prepare('INSERT OR REPLACE INTO merged_graph_edges (id, source_merged_node_id, target_merged_node_id, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    case 'user_mastery':
      return db.prepare('INSERT OR REPLACE INTO user_mastery (id, target_type, target_id, json, updated_at) VALUES (?, ?, ?, ?, ?)')
    case 'llm_jobs':
      return db.prepare('INSERT OR REPLACE INTO llm_jobs (id, job_type, status, paper_id, node_id, cache_key, json, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    case 'node_understanding_memories':
      return db.prepare('INSERT OR REPLACE INTO node_understanding_memories (id, node_id, source_paper_id, normalized_node_label, node_type, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  }
}

function paramsForTable<T extends { id: string; createdAt?: string; updatedAt?: string; fetchedAt?: string; finishedAt?: string }>(
  table: JsonTableName,
  record: T,
  indexes: Record<string, string | number | boolean | null | undefined>
): unknown[] {
  const json = JSON.stringify(record)
  switch (table) {
    case 'papers':
      return [record.id, json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'paper_insights':
      return [record.id, indexes.paperId ?? null, json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'graph_nodes':
      return [record.id, indexes.paperId ?? null, indexes.normalizedLabel ?? '', indexes.nodeType ?? '', json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'graph_edges':
      return [record.id, indexes.paperId ?? null, indexes.sourceNodeId ?? null, indexes.targetNodeId ?? null, json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'reading_sessions':
      return [record.id, indexes.paperId ?? null, json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'learning_tasks':
      return [record.id, indexes.paperId ?? null, indexes.nodeId ?? null, json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'diagnoses':
      return [record.id, indexes.paperId ?? null, indexes.nodeId ?? null, indexes.taskId ?? null, json, record.createdAt ?? null]
    case 'node_expansions':
      return [record.id, indexes.paperId ?? null, indexes.nodeId ?? null, json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'paper_search_results':
      return [record.id, indexes.provider ?? null, indexes.externalId ?? null, indexes.cacheKey ?? null, json, record.fetchedAt ?? null, indexes.expiresAt ?? null]
    case 'merged_graph_nodes':
      return [record.id, indexes.normalizedLabel ?? '', indexes.nodeType ?? '', json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'merged_graph_edges':
      return [record.id, indexes.sourceMergedNodeId ?? null, indexes.targetMergedNodeId ?? null, json, record.createdAt ?? null, record.updatedAt ?? null]
    case 'user_mastery':
      return [record.id, indexes.targetType ?? null, indexes.targetId ?? null, json, record.updatedAt ?? null]
    case 'llm_jobs':
      return [record.id, indexes.jobType ?? null, indexes.status ?? null, indexes.paperId ?? null, indexes.nodeId ?? null, indexes.cacheKey ?? null, json, record.createdAt ?? null, record.finishedAt ?? null]
    case 'node_understanding_memories':
      return [record.id, indexes.nodeId ?? null, indexes.sourcePaperId ?? null, indexes.normalizedNodeLabel ?? '', indexes.nodeType ?? '', json, record.createdAt ?? null, record.updatedAt ?? null]
  }
}

function filterNodeUnderstandingMemories(
  memories: NodeUnderstandingMemory[],
  query: NodeUnderstandingMemoryQuery
): NodeUnderstandingMemory[] {
  const normalizedLabel = query.normalizedNodeLabel ?? (query.nodeLabel ? normalizeKg4NodeLabel(query.nodeLabel) : undefined)
  const topicTags = new Set((query.topicTags ?? []).map(normalizeKg4NodeLabel))
  const methodFamilyTags = new Set((query.methodFamilyTags ?? []).map(normalizeKg4NodeLabel))
  const relatedPaperIds = new Set(query.relatedPaperIds ?? [])

  return memories
    .filter((memory) => !normalizedLabel || memory.normalizedNodeLabel === normalizedLabel)
    .filter((memory) => !query.nodeType || memory.nodeType === query.nodeType)
    .filter((memory) => !query.sourcePaperId || memory.sourcePaperId === query.sourcePaperId)
    .filter((memory) => !topicTags.size || memory.topicTags.some((tag) => topicTags.has(normalizeKg4NodeLabel(tag))))
    .filter((memory) => !methodFamilyTags.size || memory.methodFamilyTags.some((tag) => methodFamilyTags.has(normalizeKg4NodeLabel(tag))))
    .filter((memory) => !relatedPaperIds.size || memory.relatedPaperIds.some((paperId) => relatedPaperIds.has(paperId)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, query.limit ?? 50)
}

function buildMemoryReuseSuggestions(
  memories: NodeUnderstandingMemory[],
  params: { node: GraphNodeRecord; topicTags: string[]; methodFamilyTags: string[]; limit?: number }
): MemoryReuseSuggestion[] {
  const normalizedNodeLabel = params.node.normalizedLabel || normalizeKg4NodeLabel(params.node.label)
  const topicTags = new Set(params.topicTags.map(normalizeKg4NodeLabel))
  const methodFamilyTags = new Set(params.methodFamilyTags.map(normalizeKg4NodeLabel))

  return memories
    .map((memory) => {
      const matchedSignals: MemoryReuseSuggestion['matchedSignals'] = []
      if (memory.normalizedNodeLabel === normalizedNodeLabel) matchedSignals.push('normalized_label')
      if (memory.nodeType === params.node.nodeType) matchedSignals.push('node_type')
      if (memory.topicTags.some((tag) => topicTags.has(normalizeKg4NodeLabel(tag)))) matchedSignals.push('topic_tag')
      if (memory.methodFamilyTags.some((tag) => methodFamilyTags.has(normalizeKg4NodeLabel(tag)))) matchedSignals.push('method_family')
      const confidence = Math.min(0.95, matchedSignals.length * 0.22 + (matchedSignals.includes('normalized_label') ? 0.35 : 0))
      return {
        id: stableId('memory_reuse', `${memory.id}:${params.node.id}`),
        memoryId: memory.id,
        currentNodeId: params.node.id,
        currentPaperId: params.node.paperId,
        matchReason: `匹配信号：${matchedSignals.join(', ') || 'weak'}`,
        matchedSignals,
        confidence,
        suggestedReuseText: memory.userEditedUnderstandingNote || memory.generatedUnderstandingNote
      }
    })
    .filter((suggestion) => suggestion.confidence >= 0.3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, params.limit ?? 5)
}

export function createPaperMemoryRepository(): PaperMemoryRepository {
  try {
    return new SqlitePaperMemoryRepository()
  } catch (err) {
    console.warn('[KG3] SQLite repository unavailable, falling back to JSON file repository:', err)
    return new FilePaperMemoryRepository()
  }
}

export const paperMemoryRepository = createPaperMemoryRepository()
