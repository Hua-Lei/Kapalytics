import { callLlm, hasApiKey } from './client'
import { buildDiagnosisPrompt } from './prompts/diagnosis'

export interface DiagnosisResult {
  isCorrect: boolean
  errorType: string
  feedback: string
  remedialTask: string
}

export interface GraphNode {
  id: string
  type: string
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

export interface GeneratedGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GeneratedTasks {
  tasks: Record<string, string>
}

export interface PaperAnalysisResult {
  graph: GeneratedGraph
  tasks: Record<string, string>
}

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

const ANALYSIS_SYSTEM_PROMPT = `你是 AI 论文深度学习助手。根据论文全文摘录，一次性生成展示版学习工作台所需数据。
你的目标不是摘要论文，而是建立“学习这篇论文需要掌握的知识结构”。请优先抽取论文自己的核心问题、方法机制、公式、训练目标、实验验证和局限。

节点类型只能使用：field, concept, problem, method, formula, experiment, limitation。
节点设计规则：
- field：论文所在研究位置，不要泛泛写“机器学习”，要写具体方向，例如“语言驱动的参数高效适配”。
- problem：论文要解决的具体瓶颈，例如“每个任务都要重新微调 LoRA 的成本”。
- concept：理解论文必须先懂的概念，例如 LoRA、hypernetwork、task embedding、zero-shot adapter generation。
- method：论文提出的机制，必须来自本文，例如 Text-to-LoRA hypernetwork、LoRA reconstruction training、SFT training。
- formula：只放关键公式/目标函数/参数化关系；PDF 文本中公式可能被拆散，请优先使用 [Formula candidates extracted from PDF] 中带 Page/y 的候选行，并结合前后页面上下文还原，description 要解释符号含义和它在方法中的作用。
- experiment：只放用来验证 claim 的实验，例如 compression ratio、zero-shot benchmarks、ablation on task descriptions。
- limitation：论文方法边界或失败条件，不要编造。
边设计规则：边要表达学习依赖或论文论证关系，例如“动机”“解决”“生成”“训练目标”“验证”“限制”。不要生成松散同义关系。
阶段 ID 必须完整包含：field_positioning, problem_motivation, method_overview, formula_algorithm, experiment_analysis, contribution_limitation, transfer_comparison。
每个阶段任务必须引用当前论文的具体实体/实验/公式，不得使用 Transformer、RNN 翻译等模板内容，除非论文本身讨论它。
如果论文是 Text-to-LoRA/T2L，图谱应区分：任务描述嵌入、hypernetwork、LoRA A/B 矩阵生成、LoRA reconstruction loss、SFT loss、压缩比实验、zero-shot benchmark、任务描述消融。
输出严格 JSON object，不要 markdown。JSON 示例：
{
  "graph": {
    "nodes": [{ "id": "n1", "type": "field", "label": "节点标签", "description": "面向学习者的简短解释", "x": 400, "y": 50 }],
    "edges": [{ "id": "e1", "sourceId": "n1", "targetId": "n2", "label": "关系", "directed": true }]
  },
  "tasks": {
    "field_positioning": "阶段任务",
    "problem_motivation": "阶段任务",
    "method_overview": "阶段任务",
    "formula_algorithm": "阶段任务",
    "experiment_analysis": "阶段任务",
    "contribution_limitation": "阶段任务",
    "transfer_comparison": "阶段任务"
  }
}
要求：10-14 个节点，12-18 条边；至少包含 1 个 formula 节点和 2 个 experiment 节点。`

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

function compactPaperText(text: string): string {
  const formulaSection = text.match(/\[Formula candidates extracted from PDF\][\s\S]*$/)?.[0] ?? ''
  const compactBody = text
    .replace(/\s+/g, ' ')
    .replace(/References\s+[\s\S]*$/i, '')
    .trim()
    .slice(0, 18000)
  return formulaSection ? `${compactBody}\n\n${formulaSection}` : compactBody
}

export async function aiAnalyzePaper(
  paperText: string,
  onProgress?: ProgressFn
): Promise<PaperAnalysisResult> {
  if (!hasApiKey()) throw new Error('no_api_key')

  const compactText = compactPaperText(paperText)
  onProgress?.(`正在压缩论文文本（发送 ${compactText.length} 字符）...`)

  const res = await callLlm({
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: `论文全文摘录：${compactText}\n\n请生成完整 JSON object。` }
    ],
    maxTokens: 4096,
    temperature: 0.2,
    timeoutMs: 180000,
    jsonMode: true
  })

  onProgress?.('正在解析 AI 返回的图谱和任务...')
  const parsed = await parseJsonObjectWithRepair(res.content) as Partial<PaperAnalysisResult>
  if (!parsed.graph || !Array.isArray(parsed.graph.nodes) || !Array.isArray(parsed.graph.edges)) {
    throw new Error('AI 返回结果缺少 graph.nodes 或 graph.edges')
  }
  if (!parsed.tasks || typeof parsed.tasks !== 'object') {
    throw new Error('AI 返回结果缺少 tasks')
  }
  onProgress?.(`已生成 ${parsed.graph.nodes.length} 个节点和 7 个学习阶段任务`)
  return { graph: parsed.graph, tasks: parsed.tasks }
}
