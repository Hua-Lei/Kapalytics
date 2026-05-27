import { DiagnosisResult } from './types'

interface StageDiagnosis {
  errorType: DiagnosisResult['errorType']
  keywords: string[]
  feedback: string
  remedialTask: string
}

const diagnosisMap: Record<string, StageDiagnosis> = {
  field_positioning: {
    errorType: 'field_misclassification',
    keywords: ['NLP', '自然语言', '序列', '翻译', '语言模型', '文本', 'transformer', '注意力', 'seq2seq', '机器翻译'],
    feedback:
      '你可能将该论文归类到了错误的 AI 子领域。Transformer 的核心贡献是用自注意力替代循环结构进行序列建模，属于自然语言处理与深度学习架构领域，而非计算机视觉或强化学习。关键区分点：该领域关注序列到序列的建模方式变革。',
    remedialTask: '请重新阅读论文标题和摘要，指出论文中哪些关键词表明它属于 NLP/深度学习架构领域？'
  },
  problem_motivation: {
    errorType: 'concept_confusion',
    keywords: ['并行', '序列', 'RNN', 'LSTM', '长距离', '梯度', '效率', '训练', '瓶颈', '顺序', '依赖'],
    feedback:
      '你对 RNN 瓶颈的理解可能混淆了"计算效率"和"信息丢失"两个概念。RNN 核心问题：1) 无法并行化——每步依赖前一步隐状态；2) 长距离梯度消失——远距离 token 间信号衰减。两个问题是正交的。',
    remedialTask: '请分别用一句话说明 RNN 的并行化问题和梯度消失问题，并解释 Transformer 为什么能同时解决这两个问题。'
  },
  method_overview: {
    errorType: 'method_flow_error',
    keywords: ['嵌入', '位置编码', '编码器', '解码器', 'attention', 'softmax', 'FFN', '前馈', '残差', '归一化', 'cross'],
    feedback:
      '你对方法流程可能遗漏了关键模块。完整流程：输入 Token → 嵌入+位置编码 → N×编码器(Self-Attn+FFN) → N×解码器(Masked+Cross-Attn+FFN) → 线性+Softmax → 输出。常见遗漏：Cross-Attention 连接编解码器。',
    remedialTask: '请补全完整流程，特别说明 Cross-Attention 的 Q、K、V 分别来自编码器还是解码器。'
  },
  formula_algorithm: {
    errorType: 'formula_misunderstanding',
    keywords: ['Q', 'K', 'V', 'query', 'key', 'value', 'softmax', '点积', 'sqrt', 'dk', '缩放', '投影', '权重'],
    feedback:
      '公式 $Attention(Q,K,V) = softmax(QK^T/\\sqrt{d_k})V$ 中：Q 代表"我在找什么"，K 代表"我能提供什么"，V 代表"实际传递内容"。除以 $\\sqrt{d_k}$ 防止点积过大导致梯度消失。Q/K/V 来自同一输入的不同线性投影。',
    remedialTask: '请重新解释：为什么 Q、K、V 需要不同的投影矩阵？如果都用相同的投影矩阵会发生什么？'
  },
  experiment_analysis: {
    errorType: 'experiment_misinterpretation',
    keywords: ['BLEU', 'WMT', '主实验', '消融', '对比', 'baseline', 'SOTA', '头数', '维度', '验证', 'claim'],
    feedback:
      '你混淆了主实验和消融实验的目的。主实验(WMT)验证核心声明：Transformer 优于其他架构。消融实验验证设计选择合理性：注意力头数变化表明多头帮助关注不同子空间。',
    remedialTask: '请重新判断：消融实验发现 h=1 时 BLEU 下降>1 点验证了什么？主实验 BLEU 比其他模型高 2 分验证了什么？'
  },
  contribution_limitation: {
    errorType: 'contribution_misjudgement',
    keywords: ['贡献', '创新', '已有', '改进', '提出', '首次', 'O(n', '复杂度', '局限', '缺点', '不足', '长序列'],
    feedback:
      '你对贡献的判断可能混入了已有工作。注意区分：1) 已有：注意力机制(Bahdanau 2014)、编码器-解码器(Sutskever 2014)；2) 本文改进：完全移除 RNN/CNN；3) 真正贡献：证明纯注意力架构在性能和效率上均超越 RNN/CNN。O(n²) 复杂度是内生局限。',
    remedialTask: '请用"已有工作 → 本文改进 → 真正贡献"三栏格式重新总结 Transformer 的贡献。'
  },
  transfer_comparison: {
    errorType: 'transfer_insufficient',
    keywords: ['迁移', 'CV', '图像', '语音', '通用', 'ViT', '适用', '其他', '领域', '修改', '复用', 'patch', 'embedding'],
    feedback:
      '你的迁移分析深度不够。Self-Attention 的泛化性来自：1) 输入无关性——对任意序列计算成对相关性；2) 全局感受野——每层可直接访问所有位置。迁移时需修改：输入嵌入方式、位置编码策略。',
    remedialTask: '请思考：把 Transformer 迁移到分子结构预测任务，哪些模块可直接复用？至少给出两个必须修改的部分和理由。'
  }
}

export function diagnose(stageId: string, userAnswer: string): DiagnosisResult {
  const entry = diagnosisMap[stageId]
  if (!entry) {
    return {
      isCorrect: true,
      errorType: 'concept_confusion',
      feedback: '你的回答已记录。',
      remedialTask: '请继续下一阶段的学习。'
    }
  }

  const lower = userAnswer.toLowerCase()
  const matched = entry.keywords.filter((kw) => lower.includes(kw.toLowerCase()))
  const ratio = matched.length / entry.keywords.length

  if (matched.length === 0) {
    // No keywords matched — definitely wrong
    return {
      isCorrect: false,
      errorType: entry.errorType,
      feedback: `你的回答未涉及本阶段的关键概念（如：${entry.keywords.slice(0, 5).join('、')}等）。${entry.feedback}`,
      remedialTask: entry.remedialTask
    }
  }

  if (ratio < 0.3) {
    // Few keywords — likely incomplete understanding
    return {
      isCorrect: false,
      errorType: entry.errorType,
      feedback: `你的回答覆盖了部分要点（匹配关键词：${matched.join('、')}），但关键概念覆盖不足。${entry.feedback}`,
      remedialTask: entry.remedialTask
    }
  }

  if (ratio < 0.5) {
    // Borderline — flag for review but acknowledge effort
    return {
      isCorrect: false,
      errorType: entry.errorType,
      feedback: `你的回答有一定理解（匹配：${matched.join('、')}），但深度不够。${entry.feedback}`,
      remedialTask: entry.remedialTask
    }
  }

  // Good answer
  return {
    isCorrect: true,
    errorType: entry.errorType,
    feedback: `你的回答覆盖了关键概念（${matched.join('、')}），思路基本正确。当前为离线模式，接入 AI 可获得更详细反馈。`,
    remedialTask: '尝试用自己的话向同学复述本阶段核心概念，巩固理解。'
  }
}
