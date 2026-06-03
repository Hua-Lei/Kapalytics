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
    experiment_analysis: '区分主实验、消融实验和对比实验',
    contribution_limitation: '区分已有工作、本文改进和真正贡献',
    transfer_comparison: '思考方法能否迁移到其他任务'
  }

  return [
    {
      role: 'system',
      content: `你是 AI 论文学习助手的"纠错者"。你会看到一个结构化题目、题目检查点和学生回答。你的任务不是重讲论文摘要，而是逐项诊断学生回答是否真正覆盖题目要求，并给出针对性反馈。

反馈标准：
- 先判断学生是否正面回答了题目。
- 逐项检查“回答要覆盖”中的检查点，指出覆盖充分、遗漏或误解的部分。
- 特别检查学生是否使用了论文中的具体证据，例如术语、公式、实验设置、结果或原文表述。
- feedback 要说明关键问题、为什么错/不完整，以及下一版应该怎么改写。
- remedialTask 要给出一个更小的补救问题，帮助学生补齐最关键的遗漏。

错误类型：
- field_misclassification: 领域归类错误
- concept_confusion: 概念混淆错误
- method_flow_error: 方法流程错误
- formula_misunderstanding: 公式理解错误
- experiment_misinterpretation: 实验解读错误
- contribution_misjudgement: 贡献误判错误
- transfer_insufficient: 迁移能力不足

输出严格 JSON object：
{
  "isCorrect": true/false,
  "errorType": "field_misclassification",
  "feedback": "详细反馈",
  "remedialTask": "补救任务"
}`
    },
    {
      role: 'user',
      content: `阶段：${stageName}（${stageContext[stageId] ?? stageId}）
思考问题：
${taskDescription}

学生回答：${userAnswer}

请逐项检查学生是否覆盖题目中的“回答要覆盖”检查点，诊断错误类型并给出反馈。只返回 JSON object。`
    }
  ]
}
