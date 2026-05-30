import type { Stage } from '../../types'

export interface StageDefinition {
  id: string
  order: number
  name: string
  description: string
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 'field_positioning',
    order: 1,
    name: '领域定位',
    description: '判断这篇论文属于哪个 AI 子领域，理解该领域的研究目标和与其他领域的区别。',
  },
  {
    id: 'problem_motivation',
    order: 2,
    name: '问题动机',
    description: '用一句话概括论文解决的核心问题，理解作者的研究动机和问题设定。',
  },
  {
    id: 'method_overview',
    order: 3,
    name: '方法主线',
    description: '提炼论文方法的输入、核心模块、处理流程、输出和优化目标，从细节中抽取出方法主线。',
  },
  {
    id: 'formula_algorithm',
    order: 4,
    name: '公式算法',
    description: '理解关键公式中每一项的作用和训练目标，能解释公式为什么对解决问题有效。',
  },
  {
    id: 'experiment_analysis',
    order: 5,
    name: '实验解读',
    description: '区分主实验、消融实验和对比实验，判断每个实验验证了论文的哪个 claim。',
  },
  {
    id: 'contribution_limitation',
    order: 6,
    name: '贡献局限',
    description: '区分已有工作、本文改进和真正贡献，客观评价论文的局限性和适用范围。',
  },
  {
    id: 'transfer_comparison',
    order: 7,
    name: '迁移对比',
    description: '思考该方法能否迁移到其他任务或问题中，判断哪些模块可复用、哪些需要修改。',
  },
]

/**
 * Combine static stage definitions with per-paper tasks to produce Stage objects.
 *
 * @param tasks - A record mapping stage id to its paper-specific task prompt.
 *                Stages without a corresponding task entry receive a generic fallback.
 */
export function buildStagesFromTasks(tasks: Record<string, string>): Stage[] {
  return STAGE_DEFINITIONS.map((def) => ({
    id: def.id,
    order: def.order,
    name: def.name,
    status: 'not_started' as const,
    mastery: 0,
    description: def.description,
    task: tasks[def.id] ?? `请根据论文内容完成"${def.name}"阶段的学习任务。`,
  }))
}
