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

const STAGE_QUESTION_CHECKPOINTS: Record<string, string[]> = {
  field_positioning: [
    '具体研究方向或子领域',
    '本文要解决的问题或方法位置',
    '它与已有方法/相邻领域的关系',
    '论文证据、公式或实验结果'
  ],
  problem_motivation: [
    '核心瓶颈是什么',
    '作者为什么认为这个瓶颈重要',
    '已有方法在这里哪里不够',
    '论文证据、公式或实验结果'
  ],
  method_overview: [
    '输入是什么',
    '核心模块或关键步骤是什么',
    '输出是什么',
    '训练目标或优化方式如何连接这些步骤',
    '论文证据、公式或实验结果'
  ],
  formula_algorithm: [
    '关键公式或算法目标是什么',
    '每个核心符号/变量的含义',
    '公式在方法流程中的作用',
    '论文证据、公式或实验结果'
  ],
  experiment_analysis: [
    '两个关键实验分别验证什么 claim',
    '实验设置或对比对象是什么',
    '结果如何支持或削弱 claim',
    '论文证据、公式或实验结果'
  ],
  contribution_limitation: [
    '本文相对已有工作的真正贡献',
    '方法适用边界或失败条件',
    '哪些结论仍需要谨慎看待',
    '论文证据、公式或实验结果'
  ],
  transfer_comparison: [
    '这个方法可迁移的模块或思想',
    '迁移到新任务时需要改变什么',
    '它与相关方法在泛化方式上的差异',
    '论文证据、公式或实验结果'
  ]
}

const STRUCTURED_QUESTION_MARKERS = [/请回答[:：]/, /回答要覆盖[:：]/]

function isStructuredQuestion(task: string): boolean {
  return STRUCTURED_QUESTION_MARKERS.every((marker) => marker.test(task))
}

export function formatStageTaskAsQuestion(stageId: string, stageName: string, task: string | undefined): string {
  const trimmed = task?.trim()
  if (trimmed && isStructuredQuestion(trimmed)) return trimmed

  const question = trimmed || `请根据论文内容说明“${stageName}”阶段最关键的理解点。`
  const checkpoints = STAGE_QUESTION_CHECKPOINTS[stageId] ?? [
    '你的核心判断',
    '支撑这个判断的推理链条',
    '论文中的具体证据'
  ]

  return [
    `请回答：${question}`,
    '回答要覆盖：',
    ...checkpoints.map((checkpoint, index) => `${index + 1}. ${checkpoint}`)
  ].join('\n')
}

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
    task: formatStageTaskAsQuestion(def.id, def.name, tasks[def.id]),
  }))
}
