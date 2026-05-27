import { callLlm, hasApiKey } from './client'
import { AiGenerateRequest } from './types'
import { buildDiagnosisPrompt } from './prompts/diagnosis'
import { DiagnosisResult } from '../diagnosis/types'
import { KnowledgeGraph } from '../graph/types'
import { Stage } from '../../types'

export async function aiDiagnose(
  stageId: string,
  stageName: string,
  taskDescription: string,
  userAnswer: string
): Promise<DiagnosisResult> {
  if (!hasApiKey()) {
    throw new Error('no_api_key')
  }

  const messages = buildDiagnosisPrompt(stageId, stageName, taskDescription, userAnswer)
  const res = await callLlm({
    model: 'claude-sonnet-4-6',
    messages,
    maxTokens: 1024,
    temperature: 0.3
  })

  const text = res.content.trim()
  // Try to parse JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`无法解析 AI 返回的诊断结果: ${text.slice(0, 200)}`)
  }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    isCorrect: parsed.isCorrect ?? false,
    errorType: parsed.errorType ?? 'concept_confusion',
    feedback: parsed.feedback ?? 'AI 诊断结果解析异常，请重试。',
    remedialTask: parsed.remedialTask ?? '请重新阅读论文相关内容后再次作答。'
  }
}

export async function aiGenerateKnowledgeGraph(paperAbstract: string): Promise<KnowledgeGraph> {
  if (!hasApiKey()) {
    throw new Error('no_api_key')
  }

  const res = await callLlm({
    model: 'claude-sonnet-4-6',
    messages: [
      {
        role: 'system',
        content: `你是 AI 论文学习助手的"知识定位者"。根据论文摘要生成知识图谱。

节点类型：field(领域), concept(核心概念), problem(研究问题), method(方法模块), formula(公式算法), experiment(实验), limitation(局限)

输出格式（严格 JSON）：
{
  "nodes": [
    { "id": "n1", "type": "field", "label": "节点标签", "description": "简短描述", "x": 400, "y": 50 }
  ],
  "edges": [
    { "id": "e1", "sourceId": "n1", "targetId": "n2", "label": "关系", "directed": true }
  ]
}
x,y 坐标范围 0-800, 0-860，纵向分层排列（领域在上，概念/问题中层，方法/实验/局限在下层）。
返回约 8-14 个节点，10-16 条边。只返回 JSON。`
      },
      {
        role: 'user',
        content: `论文摘要：${paperAbstract}\n\n请生成知识图谱 JSON。`
      }
    ],
    maxTokens: 4096,
    temperature: 0.3
  })

  const text = res.content.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('无法解析 AI 生成的知识图谱')
  return JSON.parse(jsonMatch[0])
}

export async function aiGenerateStageTasks(
  paperAbstract: string,
  stages: Stage[]
): Promise<Stage[]> {
  if (!hasApiKey()) {
    throw new Error('no_api_key')
  }

  const stageList = stages
    .map((s) => `- ${s.id}: ${s.name}（${s.description}）`)
    .join('\n')

  const res = await callLlm({
    model: 'claude-sonnet-4-6',
    messages: [
      {
        role: 'system',
        content: `你是 AI 论文学习助手的"提问者"。根据论文摘要和阶段定义，为每个学习阶段生成具体任务。

输出格式（严格 JSON）：
{
  "tasks": {
    "stage_id_1": "该阶段的具体任务描述（含可用的 LaTeX 公式，用 $ 或 $$ 包裹）",
    "stage_id_2": "..."
  }
}
任务应该：1) 具体针对论文内容 2) 要求主动思考而非简单复述 3) 包含具体问题引导。只返回 JSON。`
      },
      {
        role: 'user',
        content: `论文摘要：${paperAbstract}\n\n学习阶段：\n${stageList}\n\n请为每个阶段生成任务 JSON。`
      }
    ],
    maxTokens: 4096,
    temperature: 0.5
  })

  const text = res.content.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('无法解析 AI 生成的任务')
  const tasks = JSON.parse(jsonMatch[0]).tasks

  return stages.map((s) => ({
    ...s,
    task: tasks[s.id] ?? s.task
  }))
}
