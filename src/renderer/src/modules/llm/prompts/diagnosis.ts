import { LlmMessage } from '../types'

export function buildDiagnosisPrompt(
  stageId: string,
  stageName: string,
  taskDescription: string,
  userAnswer: string
): LlmMessage[] {
  const stageContext: Record<string, string> = {
    field_positioning: '判断论文所属 AI 子领域',
    problem_motivation: '概括论文解决的核心问题',
    method_overview: '提炼论文方法的输入、模块、流程和输出',
    formula_algorithm: '理解关键公式中每一项的含义和作用',
    experiment_analysis: '区分主实验、消融实验和对比实验，判断实验验证了哪个 claim',
    contribution_limitation: '区分已有工作、本文改进和真正贡献',
    transfer_comparison: '思考方法能否迁移到其他任务'
  }

  return [
    {
      role: 'system',
      content: `你是 AI 论文学习助手的"纠错者"。你的任务是诊断学生对论文的理解错误，并给出针对性反馈。

诊断规则：
1. 判断学生的回答是否存在以下错误类型：
   - 领域归类错误：把论文归到错误的 AI 子领域
   - 概念混淆错误：混淆两个相近概念
   - 方法流程错误：遗漏关键模块或步骤
   - 公式理解错误：不理解公式各项含义
   - 实验解读错误：看不懂实验类型和目的
   - 贡献误判错误：把已有工作当作本文创新
   - 迁移能力不足：无法从单篇论文推导到其他场景
2. 如果回答正确或基本正确，也要明确告知

输出格式（严格 JSON）：
{
  "isCorrect": true/false,
  "errorType": "field_misclassification" | "concept_confusion" | "method_flow_error" | "formula_misunderstanding" | "experiment_misinterpretation" | "contribution_misjudgement" | "transfer_insufficient",
  "feedback": "详细的诊断反馈，指出具体哪里对/错，为什么",
  "remedialTask": "一个具体的补救任务，帮助学生纠正理解偏差"
}`
    },
    {
      role: 'user',
      content: `论文学习阶段：${stageName}（${stageContext[stageId] ?? stageId}）

阶段任务：${taskDescription}

学生回答：${userAnswer}

请诊断学生回答中的错误类型并给出反馈。只返回 JSON，不要其他内容。`
    }
  ]
}
