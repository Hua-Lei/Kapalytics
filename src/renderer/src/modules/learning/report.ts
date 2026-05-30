import type { DiagnosisResult } from '../../../../shared/electron-api'
import type { Stage } from '../../types'

export interface LearningReport {
  generatedAt: string
  summary: string
  mastered: string[]
  weakPoints: string[]
  errorHistory: Array<{ stageName: string; errorType: string; feedback: string }>
  reviewRecommendations: string[]
  nextPaperRecommendation: string
}

const errorLabels: Record<string, string> = {
  field_misclassification: '领域定位',
  concept_confusion: '概念区分',
  method_flow_error: '方法流程',
  formula_misunderstanding: '公式理解',
  experiment_misinterpretation: '实验解读',
  contribution_misjudgement: '贡献判断',
  transfer_insufficient: '迁移比较'
}

function summarizeErrorType(errorType: string): string {
  return errorLabels[errorType] ?? errorType
}

export function generateLearningReport(
  stages: Stage[],
  diagnosisResults: Record<string, DiagnosisResult>,
  answers: Record<string, string>
): LearningReport {
  const completed = stages.filter((stage) => stage.status === 'completed')
  const reviewStages = stages.filter((stage) => stage.status === 'needs_review')
  const answeredStages = stages.filter((stage) => answers[stage.id]?.trim())
  const wrongEntries = stages
    .map((stage) => ({ stage, result: diagnosisResults[stage.id] }))
    .filter((entry) => entry.result && !entry.result.isCorrect)

  const mastered = completed.length
    ? completed.map((stage) => `阶段 ${stage.order}：${stage.name}`)
    : ['尚未完成阶段。先完成至少一个学习阶段，报告会更有判断力。']

  const weakPoints = wrongEntries.length
    ? wrongEntries.map(({ stage, result }) => `阶段 ${stage.order} ${stage.name}：${summarizeErrorType(result.errorType)}`)
    : reviewStages.length
      ? reviewStages.map((stage) => `阶段 ${stage.order} ${stage.name}：已标记为需复习`)
      : ['暂无明确薄弱点。继续提交阶段回答后，系统会基于诊断记录更新。']

  const errorHistory = wrongEntries.map(({ stage, result }) => ({
    stageName: stage.name,
    errorType: summarizeErrorType(result.errorType),
    feedback: result.feedback
  }))

  const reviewRecommendations = [
    ...reviewStages.map((stage) => `优先复习「${stage.name}」，重新回答阶段任务并对照导师反馈。`),
    ...wrongEntries.slice(0, 3).map(({ stage, result }) => `针对「${stage.name}」补做：${result.remedialTask}`)
  ]

  const uniqueRecommendations = [...new Set(reviewRecommendations)]
  if (uniqueRecommendations.length === 0) {
    uniqueRecommendations.push('选择一个尚未完成的阶段，补充一段包含论文证据的回答。')
  }

  const completionRate = stages.length ? Math.round((completed.length / stages.length) * 100) : 0
  const answeredRate = stages.length ? Math.round((answeredStages.length / stages.length) * 100) : 0

  return {
    generatedAt: new Date().toISOString(),
    summary: `当前完成 ${completed.length}/${stages.length} 个阶段（${completionRate}%），已提交 ${answeredStages.length}/${stages.length} 个回答（${answeredRate}%）。${wrongEntries.length ? `发现 ${wrongEntries.length} 条诊断错误记录。` : '暂无错误诊断记录。'}`,
    mastered,
    weakPoints,
    errorHistory,
    reviewRecommendations: uniqueRecommendations,
    nextPaperRecommendation: wrongEntries.some(({ result }) => result.errorType === 'transfer_insufficient')
      ? '下一篇论文建议选择同方向但方法不同的工作，用研究问题、方法机制和实验设置做横向比较。'
      : '下一篇论文建议选择当前方法的直接相关工作，重点比较研究问题、方法类别、实验设置和局限。'
  }
}
