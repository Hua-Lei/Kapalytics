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

export async function aiDiagnose(
  stageId: string,
  stageName: string,
  taskDescription: string,
  userAnswer: string
): Promise<DiagnosisResult> {
  if (!hasApiKey()) throw new Error('no_api_key')

  const messages = buildDiagnosisPrompt(stageId, stageName, taskDescription, userAnswer)
  const res = await callLlm({ messages, maxTokens: 1024, temperature: 0.3 })

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

const GRAPH_SYSTEM_PROMPT = `你是 AI 论文学习助手的"知识定位者"。根据论文摘要生成知识图谱。
节点类型：field(领域), concept(核心概念), problem(研究问题), method(方法模块), formula(公式算法), experiment(实验), limitation(局限)
输出严格 JSON：
{
  "nodes": [{ "id": "n1", "type": "field", "label": "节点标签", "description": "简短描述", "x": 400, "y": 50 }],
  "edges": [{ "id": "e1", "sourceId": "n1", "targetId": "n2", "label": "关系", "directed": true }]
}
坐标范围 0-800, 0-860，分层排列。8-14 节点，10-16 边。只返回 JSON。`

type ProgressFn = (msg: string) => void

export async function aiGenerateGraph(
  paperAbstract: string,
  onProgress?: ProgressFn
): Promise<GeneratedGraph> {
  if (!hasApiKey()) throw new Error('no_api_key')

  onProgress?.('正在分析论文结构...')
  const res = await callLlm({
    messages: [
      { role: 'system', content: GRAPH_SYSTEM_PROMPT },
      { role: 'user', content: `论文内容：${paperAbstract.slice(0, 12000)}\n\n生成知识图谱 JSON。` }
    ],
    maxTokens: 8192,
    temperature: 0.3
  })

  onProgress?.('正在解析知识图谱节点...')
  const text = res.content.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('无法解析图谱 JSON')
  const graph = JSON.parse(jsonMatch[0])
  onProgress?.(`已生成 ${graph.nodes?.length ?? 0} 个节点，${graph.edges?.length ?? 0} 条边`)
  return graph
}

export async function aiGenerateTasks(
  paperAbstract: string,
  stages: { id: string; name: string; description: string }[],
  onProgress?: ProgressFn
): Promise<GeneratedTasks> {
  if (!hasApiKey()) throw new Error('no_api_key')

  const stageList = stages.map((s) => `- ${s.id}: ${s.name}（${s.description}）`).join('\n')
  onProgress?.('正在为 7 个阶段生成任务...')

  const res = await callLlm({
    messages: [
      {
        role: 'system',
        content: `你是 AI 论文学习助手的"提问者"。根据论文内容和阶段定义，为每个学习阶段生成具体任务。任务需包含 LaTeX 公式（用 $ 或 $$ 包裹）。输出严格 JSON：{ "tasks": { "stage_id": "任务描述" } }。只返回 JSON。`
      },
      {
        role: 'user',
        content: `论文内容：${paperAbstract.slice(0, 12000)}\n\n阶段列表：\n${stageList}\n\n生成任务 JSON。`
      }
    ],
    maxTokens: 8192,
    temperature: 0.5
  })

  onProgress?.('正在解析阶段任务...')
  const text = res.content.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('无法解析任务 JSON')
  const tasks = JSON.parse(jsonMatch[0])
  onProgress?.('任务生成完成')
  return tasks
}
