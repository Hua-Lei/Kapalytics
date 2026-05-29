import { callLlm, hasApiKey } from './client'
import { buildDiagnosisPrompt } from './prompts/diagnosis'
import type { DiagnosisResult } from '../../shared/electron-api'
import type {
  ExtractedPaperContent,
  GraphEdge,
  GraphNode,
  NodeType,
  PaperInsight,
  PaperAnalysisResult
} from '../../shared/paper'
import { formatFormulaCandidatesForPrompt } from '../paper/formulas'

export async function aiDiagnose(
  stageId: string,
  stageName: string,
  taskDescription: string,
  userAnswer: string
): Promise<DiagnosisResult> {
  if (!hasApiKey()) throw new Error('no_api_key')

  const messages = buildDiagnosisPrompt(stageId, stageName, taskDescription, userAnswer)
  const res = await callLlm({ messages, maxTokens: 1024, temperature: 0.3, jsonMode: true })

  const text = res.content.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`无法解析诊断结果: ${text.slice(0, 200)}`)

  const parsed = JSON.parse(jsonMatch[0])
  return {
    isCorrect: parsed.isCorrect ?? false,
    errorType: parsed.errorType ?? 'concept_confusion',
    feedback: parsed.feedback ?? '诊断结果解析异常',
    remedialTask: parsed.remedialTask ?? '请重新阅读论文后再次作答'
  }
}

const STAGE_IDS = [
  'field_positioning',
  'problem_motivation',
  'method_overview',
  'formula_algorithm',
  'experiment_analysis',
  'contribution_limitation',
  'transfer_comparison'
] as const

const NODE_TYPES: NodeType[] = [
  'field',
  'concept',
  'problem',
  'method',
  'formula',
  'experiment',
  'limitation'
]

const EXPANSION_TYPES = ['field_overview', 'related_papers', 'method_evolution', 'comparison'] as const

const ANALYSIS_JSON_SCHEMA_PROMPT = `你必须只输出一个严格 JSON object。DeepSeek JSON Output 只保证 JSON 语法合法，但这里还必须严格符合下面的业务 schema。

- 顶层字段必须包含且只使用：
- "insight": object
- "graph": object
- "tasks": object

insight 必须包含：
- "centralInsight": string
- "priorLimitation": string
- "methodMechanism": string
- "evidenceChain": string[]，引用图谱中的公式、实验或方法节点 label
- "remainingGap": string

graph 必须包含：
- "nodes": array
- "edges": array

node schema：
- "id": string，唯一，建议 n1/n2/n3
- "type": string，只能是 field、concept、problem、method、formula、experiment、limitation
- "label": string
- "description": string
- "x": number
- "y": number
- "insight": string，可选
- "whyImportant": string，可选
- "roleInPaper": string，可选
- "contrastWithPrior": string，可选
- "evidenceNodeIds": string[]，可选，必须引用已有 node.id
- "expandable": boolean，可选，field/concept/method 优先
- "expansionType": string，可选，只能是 field_overview、related_papers、method_evolution、comparison
- "searchQueries": string[]，可选，expandable 为 true 时提供 2-5 个查询词
- "detail": object，可选，结构化节点详情，支持 summary、keyPoints、roleInArgument、formulaExplanation、methodFlow、claimEvidence、failureConditions

edge schema：
- "id": string，唯一，建议 e1/e2/e3
- "sourceId": string，必须精确匹配某个 node.id
- "targetId": string，必须精确匹配某个 node.id
- "label": string
- "directed": boolean

tasks 必须包含下面 7 个 key，不能改名、不能缺失：
- "field_positioning"
- "problem_motivation"
- "method_overview"
- "formula_algorithm"
- "experiment_analysis"
- "contribution_limitation"
- "transfer_comparison"

禁止：
- 不要把 nodes/edges 放到顶层。
- 不要使用 knowledgeGraph、knowledge_graph、vertices、links、stageTasks、learningPath 等替代字段名。
- 不要输出 markdown、代码块、解释文字或数组顶层。
- 不要返回空 JSON、摘要 JSON 或仅包含 title/summary 的 JSON。

JSON 示例：
{
  "insight": {
    "centralInsight": "用语言描述直接生成参数高效适配器，减少每个任务重新训练的成本。",
    "priorLimitation": "已有 LoRA 适配通常需要为每个任务单独训练并保存参数。",
    "methodMechanism": "将任务描述编码后输入 hypernetwork，生成 LoRA A/B 矩阵并通过重构和 SFT 目标训练。",
    "evidenceChain": ["LoRA reconstruction loss", "zero-shot benchmark"],
    "remainingGap": "生成质量仍依赖任务描述质量和训练任务覆盖范围。"
  },
  "graph": {
    "nodes": [
      {
        "id": "n1",
        "type": "field",
        "label": "语言驱动的参数高效适配",
        "description": "论文所在的具体研究位置。",
        "x": 120,
        "y": 80,
        "insight": "把适配器从任务专属训练转为条件生成。",
        "whyImportant": "这是理解论文贡献相对 LoRA 的起点。",
        "roleInPaper": "领域背景",
        "expandable": true,
        "expansionType": "field_overview",
        "searchQueries": ["parameter efficient fine tuning", "language conditioned adapter generation"],
        "detail": {
          "summary": "论文处在参数高效适配和条件参数生成的交叉方向。",
          "keyPoints": ["降低任务级适配器训练成本", "用文本条件生成 LoRA 参数"]
        }
      },
      {
        "id": "n2",
        "type": "problem",
        "label": "任务级 LoRA 重新训练成本",
        "description": "论文试图降低每个新任务都要重新训练适配器的成本。",
        "x": 360,
        "y": 180
      }
    ],
    "edges": [
      {
        "id": "e1",
        "sourceId": "n1",
        "targetId": "n2",
        "label": "引出问题",
        "directed": true
      }
    ]
  },
  "tasks": {
    "field_positioning": "解释论文处在什么具体研究方向，以及它和已有适配方法的关系。",
    "problem_motivation": "指出论文要解决的核心瓶颈，并说明为什么该瓶颈重要。",
    "method_overview": "用论文中的核心模块串起整体方法流程。",
    "formula_algorithm": "解释论文最关键的公式或训练目标中每个符号的含义。",
    "experiment_analysis": "选择两个关键实验说明它们分别验证了什么 claim。",
    "contribution_limitation": "总结论文贡献和方法适用边界。",
    "transfer_comparison": "比较该方法与相关方法在迁移/泛化方式上的差异。"
  }
}`

const ANALYSIS_SYSTEM_PROMPT = `你是 AI 论文深度学习助手。根据论文全文摘录，一次性生成展示版学习工作台所需数据。
你的目标不是摘要论文，而是建立“学习这篇论文需要掌握的知识结构”。请优先抽取论文自己的 central insight、已有方法瓶颈、方法机制、公式、训练目标、实验验证和局限。

${ANALYSIS_JSON_SCHEMA_PROMPT}

节点类型只能使用：field, concept, problem, method, formula, experiment, limitation。
节点设计规则：
- field：论文所在研究位置，不要泛泛写“机器学习”，要写具体方向，例如“语言驱动的参数高效适配”。
- problem：论文要解决的具体瓶颈，例如“每个任务都要重新微调 LoRA 的成本”。
- concept：理解论文必须先懂的概念，例如 LoRA、hypernetwork、task embedding、zero-shot adapter generation。
- method：论文提出的机制，必须来自本文，例如 Text-to-LoRA hypernetwork、LoRA reconstruction training、SFT training。
- formula：只放关键公式/目标函数/参数化关系；PDF 候选行为规则提取的启发式 hint（不精确），请结合正文上下文修复。description 必须包含：1) 一段 KaTeX 可渲染的 LaTeX，用 $...$ 或 $$...$$ 包裹；2) 每个关键符号的中文解释；3) 该公式在方法中的作用。如果候选不完整，结合正文修复，但不要编造论文中不存在的公式。
- experiment：只放用来验证 claim 的实验，例如 compression ratio、zero-shot benchmarks、ablation on task descriptions。
- limitation：论文方法边界或失败条件，不要编造。
- 对每个核心节点尽量补充 insight、whyImportant、roleInPaper、contrastWithPrior、evidenceNodeIds。
- field / concept / method 节点如果适合继续学习，设置 expandable=true，并提供 expansionType 和 2-5 个 searchQueries。
- method 节点 detail.methodFlow 应给出输入、核心模块、输出或训练步骤。
- formula 节点 detail.formulaExplanation 应包含 KaTeX 公式、符号解释、训练目标含义、方法位置和消融思考。
- experiment 节点 detail.claimEvidence 应包含实验、验证 claim、观察结果、结论。
- limitation 节点 detail.failureConditions 应列出失败条件或适用边界。
边设计规则：边要表达学习依赖或论文论证关系，例如“动机”“解决”“生成”“训练目标”“验证”“限制”。不要生成松散同义关系。
阶段 ID 必须完整包含且只能使用：field_positioning, problem_motivation, method_overview, formula_algorithm, experiment_analysis, contribution_limitation, transfer_comparison。
每个阶段任务必须引用当前论文的具体实体/实验/公式，不得使用 Transformer、RNN 翻译等模板内容，除非论文本身讨论它。
如果论文是 Text-to-LoRA/T2L，图谱应区分：任务描述嵌入、hypernetwork、LoRA A/B 矩阵生成、LoRA reconstruction loss、SFT loss、压缩比实验、zero-shot benchmark、任务描述消融。
要求：10-14 个节点，12-18 条边；至少包含 1 个 formula 节点和 2 个 experiment 节点。必须包含 insight 顶层字段。`

type ProgressFn = (msg: string) => void

function extractJsonObject(text: string): unknown {
  if (!text.trim()) throw new Error('AI 返回了空内容，请重试')
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`无法解析 JSON: ${text.slice(0, 200)}`)
  return JSON.parse(match[0])
}

async function repairJsonObject(invalidJson: string, parseError: string): Promise<unknown> {
  const res = await callLlm({
    messages: [
      {
        role: 'system',
        content: `你是 JSON 修复器。用户会提供一个接近 JSON object 但语法有错误的字符串。
请修复为合法 JSON object，并保持原有字段和含义。
要求：
- 只返回合法 json object，不要 markdown。
- 不要新增解释文字。
- 字符串中的 LaTeX 反斜杠必须正确转义，例如 \\Delta、\\theta、\\frac。
- 如果数组元素之间缺少逗号，请补齐。
- 如果字符串引号未转义，请转义。`
      },
      {
        role: 'user',
        content: `解析错误：${parseError}

待修复 JSON：
${invalidJson}`
      }
    ],
    maxTokens: 8192,
    temperature: 0,
    timeoutMs: 180000,
    jsonMode: true
  })

  return extractJsonObject(res.content)
}

async function parseJsonObjectWithRepair(text: string): Promise<unknown> {
  try {
    return extractJsonObject(text)
  } catch (err) {
    if (err instanceof SyntaxError) {
      return repairJsonObject(text, err.message)
    }
    throw err
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function readNumber(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readArray(record: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return undefined
}

function readStringArray(record: Record<string, unknown>, keys: string[]): string[] | undefined {
  const value = readArray(record, keys)
  if (!value) return undefined
  const strings = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  return strings.length ? strings.map((item) => item.trim()) : undefined
}

function normalizePaperInsight(value: unknown): PaperInsight | undefined {
  if (!isRecord(value)) return undefined
  const centralInsight = readString(value, ['centralInsight', 'central_insight', 'insight'])
  const priorLimitation = readString(value, ['priorLimitation', 'prior_limitation', 'limitation'])
  const methodMechanism = readString(value, ['methodMechanism', 'method_mechanism', 'mechanism'])
  const evidenceChain = readStringArray(value, ['evidenceChain', 'evidence_chain', 'evidence']) ?? []
  const remainingGap = readString(value, ['remainingGap', 'remaining_gap', 'gap'])
  if (!centralInsight && !priorLimitation && !methodMechanism && !remainingGap) return undefined
  return {
    centralInsight: centralInsight ?? '',
    priorLimitation: priorLimitation ?? '',
    methodMechanism: methodMechanism ?? '',
    evidenceChain,
    remainingGap: remainingGap ?? ''
  }
}

function findGraphRecord(parsed: Record<string, unknown>): Record<string, unknown> | undefined {
  for (const key of ['graph', 'knowledgeGraph', 'knowledge_graph', 'conceptGraph']) {
    const value = parsed[key]
    if (isRecord(value)) return value
  }
  return undefined
}

function normalizeNode(value: unknown, index: number): GraphNode | null {
  if (!isRecord(value)) return null
  const id = readString(value, ['id', 'nodeId', 'node_id', 'key']) ?? `n${index + 1}`
  const rawType = readString(value, ['type', 'nodeType', 'node_type']) as NodeType | undefined
  const type = rawType && NODE_TYPES.includes(rawType) ? rawType : 'concept'
  const label = readString(value, ['label', 'name', 'title']) ?? id
  const description = readString(value, ['description', 'summary', 'explanation', 'content']) ?? label

  const evidenceNodeIds = readStringArray(value, ['evidenceNodeIds', 'evidence_node_ids'])
  const searchQueries = readStringArray(value, ['searchQueries', 'search_queries', 'queries'])
  const expansionType = readString(value, ['expansionType', 'expansion_type'])
  const detail = isRecord(value.detail) ? value.detail : undefined

  return {
    id,
    type,
    label,
    description,
    x: readNumber(value, 'x', 120 + (index % 4) * 240),
    y: readNumber(value, 'y', 80 + Math.floor(index / 4) * 150),
    insight: readString(value, ['insight', 'keyInsight', 'key_insight']),
    whyImportant: readString(value, ['whyImportant', 'why_important', 'importance']),
    roleInPaper: readString(value, ['roleInPaper', 'role_in_paper', 'role']),
    contrastWithPrior: readString(value, ['contrastWithPrior', 'contrast_with_prior', 'priorContrast']),
    evidenceNodeIds,
    expandable: typeof value.expandable === 'boolean' ? value.expandable : undefined,
    expansionType: expansionType && EXPANSION_TYPES.includes(expansionType as (typeof EXPANSION_TYPES)[number])
      ? (expansionType as GraphNode['expansionType'])
      : undefined,
    searchQueries,
    detail: detail as GraphNode['detail']
  }
}

function normalizeEvidenceNodeIds(nodes: GraphNode[]): GraphNode[] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  return nodes.map((node) => ({
    ...node,
    evidenceNodeIds: node.evidenceNodeIds?.filter((id) => nodeIds.has(id))
  }))
}

function resolveNodeRef(
  value: string | undefined,
  nodeIds: Set<string>,
  labelToId: Map<string, string>
): string | undefined {
  if (!value) return undefined
  if (nodeIds.has(value)) return value
  return labelToId.get(value)
}

function normalizeEdge(
  value: unknown,
  index: number,
  nodeIds: Set<string>,
  labelToId: Map<string, string>
): GraphEdge | null {
  if (!isRecord(value)) return null
  const sourceId = resolveNodeRef(
    readString(value, ['sourceId', 'source_id', 'source', 'from']),
    nodeIds,
    labelToId
  )
  const targetId = resolveNodeRef(
    readString(value, ['targetId', 'target_id', 'target', 'to']),
    nodeIds,
    labelToId
  )
  if (!sourceId || !targetId || sourceId === targetId) return null

  return {
    id: readString(value, ['id', 'edgeId', 'edge_id']) ?? `e${index + 1}`,
    sourceId,
    targetId,
    label: readString(value, ['label', 'relation', 'relationship']) ?? '关联',
    directed: typeof value.directed === 'boolean' ? value.directed : true
  }
}

function normalizeTasks(value: unknown): Record<string, string> | null {
  const tasks: Record<string, string> = {}

  if (isRecord(value)) {
    for (const stageId of STAGE_IDS) {
      const task = value[stageId]
      if (typeof task === 'string' && task.trim()) tasks[stageId] = task.trim()
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue
      const id = readString(item, ['id', 'stageId', 'stage_id', 'key'])
      const task = readString(item, ['task', 'description', 'prompt', 'content'])
      if (id && task && STAGE_IDS.includes(id as (typeof STAGE_IDS)[number])) tasks[id] = task
    }
  }

  return STAGE_IDS.every((stageId) => tasks[stageId]) ? tasks : null
}

function normalizePaperAnalysisResult(parsed: unknown): PaperAnalysisResult | null {
  if (!isRecord(parsed)) return null

  const graphRecord = findGraphRecord(parsed) ?? parsed
  const rawNodes = readArray(graphRecord, ['nodes', 'vertices'])
  const rawEdges = readArray(graphRecord, ['edges', 'links'])
  if (!rawNodes || !rawEdges) return null

  const nodes = normalizeEvidenceNodeIds(rawNodes
    .map((node, index) => normalizeNode(node, index))
    .filter((node): node is GraphNode => Boolean(node)))
  if (nodes.length === 0) return null

  const nodeIds = new Set(nodes.map((node) => node.id))
  const labelToId = new Map(nodes.map((node) => [node.label, node.id]))
  const edges = rawEdges
    .map((edge, index) => normalizeEdge(edge, index, nodeIds, labelToId))
    .filter((edge): edge is GraphEdge => Boolean(edge))
  if (edges.length === 0) return null

  const tasks = normalizeTasks(
    parsed.tasks ?? parsed.stageTasks ?? parsed.stage_tasks ?? parsed.learningTasks ?? parsed.learning_tasks
  )
  if (!tasks) return null

  const insight = normalizePaperInsight(parsed.insight ?? parsed.paperInsight ?? parsed.paper_insight)
  return { insight, graph: { nodes, edges }, tasks }
}

async function repairPaperAnalysisShape(
  rawOutput: string,
  paperExcerpt: string,
  onProgress?: ProgressFn
): Promise<PaperAnalysisResult> {
  onProgress?.('AI 返回 JSON 结构不符合图谱 schema，正在修复结构...')
  const res = await callLlm({
    messages: [
      {
        role: 'system',
        content: `你是论文学习图谱 JSON 结构修复器。
${ANALYSIS_JSON_SCHEMA_PROMPT}

任务：把用户提供的 AI 输出改写成完全符合上述 schema 的 JSON object。
要求：
- 只返回合法 json object。
- 必须包含 insight、graph.nodes、graph.edges、tasks。
- 尽量保留原输出的论文实体和关系。
- 如果原输出缺少必要信息，请参考论文摘录补齐，但不要编造论文中不存在的实体。`
      },
      {
        role: 'user',
        content: `论文摘录：
${paperExcerpt.slice(0, 8000)}

需要修复的 AI 输出：
${rawOutput.slice(0, 20000)}`
      }
    ],
    maxTokens: 8192,
    temperature: 0,
    timeoutMs: 180000,
    jsonMode: true
  })

  const repaired = normalizePaperAnalysisResult(await parseJsonObjectWithRepair(res.content))
  if (!repaired) throw new Error('AI 返回结果无法修复为 graph.nodes / graph.edges / tasks 结构')
  return repaired
}

function formatExtractedPaperForPrompt(content: ExtractedPaperContent): string {
  const joinedPages = content.pages
    .map((page) => `[Page ${page.page}]\n${page.text}`)
    .join('\n\n')

  const referencesIndex = joinedPages.search(/\bReferences\b/i)
  const body = referencesIndex === -1 ? joinedPages : joinedPages.slice(0, referencesIndex)

  const pages = body
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18000)

  const formulas = formatFormulaCandidatesForPrompt(content.formulaCandidates)
  return formulas ? `${pages}\n\n${formulas}` : pages
}

export async function aiAnalyzePaper(
  content: ExtractedPaperContent,
  onProgress?: ProgressFn
): Promise<PaperAnalysisResult> {
  if (!hasApiKey()) throw new Error('no_api_key')

  const compactText = formatExtractedPaperForPrompt(content)
  onProgress?.(`正在压缩论文文本（发送 ${compactText.length} 字符）...`)

  let res = await callLlm({
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `论文全文摘录：
${compactText}

请严格生成一个 JSON object，顶层必须是 {"insight":{...},"graph":{"nodes":[],"edges":[]},"tasks":{...}}。`
      }
    ],
    maxTokens: 8192,
    temperature: 0.1,
    timeoutMs: 180000,
    jsonMode: true
  })
  if (!res.content.trim()) {
    onProgress?.('DeepSeek JSON Output 返回空内容，正在重试...')
    res = await callLlm({
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `必须返回非空 JSON object，且顶层必须是 {"insight":{...},"graph":{"nodes":[],"edges":[]},"tasks":{...}}。

论文全文摘录：
${compactText}`
        }
      ],
      maxTokens: 8192,
      temperature: 0,
      timeoutMs: 180000,
      jsonMode: true
    })
  }
  onProgress?.('正在解析 AI 返回的图谱和任务...')
  const parsed = await parseJsonObjectWithRepair(res.content)
  const analysis =
    normalizePaperAnalysisResult(parsed) ??
    await repairPaperAnalysisShape(res.content, compactText, onProgress)

  onProgress?.(`已生成 ${analysis.graph.nodes.length} 个节点和 7 个学习阶段任务`)
  return analysis
}
