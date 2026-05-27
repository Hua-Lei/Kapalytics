import { DiagnosisResult } from './types'

const diagnosisMap: Record<
  string,
  { errorType: DiagnosisResult['errorType']; feedback: string; remedialTask: string }
> = {
  field_positioning: {
    errorType: 'field_misclassification',
    feedback:
      '你可能将该论文归类到了错误的 AI 子领域。Transformer 论文的核心贡献是用**自注意力机制替代循环结构**进行序列建模，这属于**自然语言处理（NLP）与深度学习架构**领域，而非传统的计算机视觉或强化学习。关键区分点：该领域关注的是序列到序列的建模方式变革，而不是图像特征提取或奖励函数设计。',
    remedialTask: '请重新阅读论文标题和摘要，指出论文中哪些关键词表明它属于 NLP/深度学习架构领域？'
  },
  problem_motivation: {
    errorType: 'concept_confusion',
    feedback:
      '你对 RNN 瓶颈的理解可能混淆了"计算效率"和"信息丢失"两个概念。RNN 的核心问题有两个层面：1) **无法并行化**——每一步依赖前一步的隐状态，导致训练缓慢；2) **长距离梯度消失**——远距离 token 之间的信号在反向传播中逐渐衰减。注意：这两个问题是正交的，并行化是计算问题，梯度消失是信息传递问题。',
    remedialTask: '请分别用一句话说明 RNN 的并行化问题和梯度消失问题，并解释 Transformer 为什么能同时解决这两个问题。'
  },
  method_overview: {
    errorType: 'method_flow_error',
    feedback:
      '你对 Transformer 方法流程的理解可能遗漏了关键模块。完整流程应为：**输入 Token → 嵌入层 + 位置编码 → N×编码器层（Self-Attention + FFN）→ N×解码器层（Masked Self-Attention + Cross-Attention + FFN）→ 线性层 + Softmax → 输出**。常见的遗漏点是：位置编码是加到嵌入向量上的（不是拼接），解码器中的 Cross-Attention 是连接编码器和解码器的关键桥梁。',
    remedialTask: '请补全完整流程，特别说明 Cross-Attention 的 Q、K、V 分别来自编码器还是解码器。'
  },
  formula_algorithm: {
    errorType: 'formula_misunderstanding',
    feedback:
      '你对 Self-Attention 公式的理解存在偏差。公式 $Attention(Q,K,V) = softmax(\\frac{QK^T}{\\sqrt{d_k}})V$ 中，每个部分的含义是：$Q$（Query）代表"我在找什么"，$K$（Key）代表"我能提供什么"，$V$（Value）代表"实际传递的内容"。除以 $\\sqrt{d_k}$ 是为了防止点积值过大导致 Softmax 梯度消失。常见误解是将 $Q$、$K$、$V$ 当作不同的输入——实际上它们都来自同一个输入的三个不同线性投影。',
    remedialTask: '请用自己的话重新解释：为什么 $Q$、$K$、$V$ 需要不同的投影矩阵 $W^Q$、$W^K$、$W^V$？如果它们都用相同的投影矩阵会发生什么？'
  },
  experiment_analysis: {
    errorType: 'experiment_misinterpretation',
    feedback:
      '你对实验的解读混淆了"主实验"和"消融实验"的目的。主实验（WMT 翻译任务）验证论文的**核心声明**：Transformer 优于当时所有其他架构。消融实验则是验证**设计选择的合理性**：比如注意力头数变化表明多头帮助模型关注不同子空间。《实验解读》关键在于：一个验证效果，一个验证设计。你的回答应将二者区分开来。',
    remedialTask: '请重新判断：如果消融实验发现 h=1 时 BLEU 下降 >1 个点，这验证了什么？如果主实验的 BLEU 比其他模型高 2 分，这又验证了什么？'
  },
  contribution_limitation: {
    errorType: 'contribution_misjudgement',
    feedback:
      '你对 Transformer 贡献的判断可能混入了已有工作。注意区分：1) **已有成果**：注意力机制（Bahdanau 2014）、编码器-解码器框架（Sutskever 2014）；2) **本文改进**：完全移除 RNN/CNN，提出 Self-Attention + Multi-Head + 位置编码的组合；3) **真正贡献**：证明纯注意力架构在性能和训练效率上均超越 RNN/CNN。局限方面，$O(n^2)$ 复杂度是内生的，不是实现上的不足。',
    remedialTask: '请用"已有工作 → 本文改进 → 真正贡献"三栏格式重新总结 Transformer 的贡献，并用一句话说明 $O(n^2)$ 复杂度在什么场景下会成为致命缺陷。'
  },
  transfer_comparison: {
    errorType: 'transfer_insufficient',
    feedback:
      '你对 Transformer 迁移能力的分析深度不够。Self-Attention 的泛化性来自于：1) **输入无关性**——它对任意序列都计算成对的相关性，不假设网格结构（CNN）或时序关系（RNN）；2) **全局感受野**——每层每个位置都能直接访问所有其他位置。迁移到新领域时需要修改的部分主要是：输入嵌入方式（文本→token embedding, 图像→patch embedding）、位置编码策略（绝对 vs 相对 vs 可学习）。',
    remedialTask: '请思考：如果把 Transformer 迁移到分子结构预测任务，哪些模块可以直接复用，哪些必须修改？至少给出两个必须修改的部分和理由。'
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

  // Deterministic fallback: very short answers likely need review
  const isBrief = userAnswer.trim().length < 20
  if (isBrief) {
    return { isCorrect: false, ...entry }
  }

  return {
    isCorrect: true,
    errorType: entry.errorType,
    feedback: '你的回答已记录。当前为离线模式，连接 AI 后可获得详细诊断反馈。',
    remedialTask: '建议接入 DeepSeek API 以获得针对性的错误诊断和补救任务。'
  }
}
