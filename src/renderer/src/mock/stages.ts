import { Stage } from '../types'

export const mockStages: Stage[] = [
  {
    id: 'field_positioning',
    order: 1,
    name: '领域定位',
    status: 'not_started',
    description: '判断这篇论文属于哪个 AI 子领域，理解该领域的研究目标和与其他领域的区别。',
    task: '这篇论文提出 Transformer 架构替代 RNN 进行序列建模。请判断它主要属于哪个 AI 子领域？并说明该领域与 CV、强化学习的主要区别。'
  },
  {
    id: 'problem_motivation',
    order: 2,
    name: '问题动机',
    status: 'not_started',
    description: '用一句话概括论文解决的核心问题，理解作者的研究动机和问题设定。',
    task: '用一句话概括 Transformer 论文解决的核心问题。RNN 在处理长序列时存在哪些具体瓶颈？为什么这些问题值得解决？'
  },
  {
    id: 'method_overview',
    order: 3,
    name: '方法主线',
    status: 'not_started',
    description: '提炼论文方法的输入、核心模块、处理流程、输出和优化目标，从细节中抽取出方法主线。',
    task: '请补全 Transformer 的方法流程：输入是什么？经过哪些核心模块？输出是什么？训练时的优化目标是什么？'
  },
  {
    id: 'formula_algorithm',
    order: 4,
    name: '公式算法',
    status: 'not_started',
    description: '理解关键公式中每一项的作用和训练目标，能解释公式为什么对解决问题有效。',
    task: 'Self-Attention 公式为 Attention(Q,K,V) = softmax(QK^T/√d_k)V。请解释：Q、K、V 分别是什么？为什么要除以 √d_k？Softmax 在这里起什么作用？'
  },
  {
    id: 'experiment_analysis',
    order: 5,
    name: '实验解读',
    status: 'not_started',
    description: '区分主实验、消融实验和对比实验，判断每个实验验证了论文的哪个 claim。',
    task: 'Transformer 在 WMT 2014 英德翻译上达到 28.4 BLEU。消融实验中，作者测试了不同注意力头数的影响。请判断：主实验验证了什么 claim？消融实验又验证了什么？'
  },
  {
    id: 'contribution_limitation',
    order: 6,
    name: '贡献局限',
    status: 'not_started',
    description: '区分已有工作、本文改进和真正贡献，客观评价论文的局限性和适用范围。',
    task: '注意力机制在此前已被提出。Transformer 的真正贡献是什么？它有哪些局限性？在什么场景下 Transformer 可能不是最佳选择？'
  },
  {
    id: 'transfer_comparison',
    order: 7,
    name: '迁移对比',
    status: 'not_started',
    description: '思考该方法能否迁移到其他任务或问题中，判断哪些模块可复用、哪些需要修改。',
    task: 'Transformer 最初用于机器翻译，后来被迁移到 CV（ViT）、语音等领域。请思考：Self-Attention 的哪些特性使它具有如此广泛的适用性？迁移到新领域时需要修改哪些部分？'
  }
]
