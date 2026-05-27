import { KnowledgeGraph } from '../modules/graph/types'

export const mockKnowledgeGraph: KnowledgeGraph = {
  nodes: [
    {
      id: 'transformer',
      type: 'field',
      label: 'Transformer',
      description: '基于自注意力机制的深度学习架构，彻底改变了自然语言处理领域',
      x: 400,
      y: 50
    },
    {
      id: 'self_attention',
      type: 'concept',
      label: '自注意力机制',
      description: '允许序列中每个位置直接关注所有其他位置，捕捉全局依赖关系',
      x: 200,
      y: 170
    },
    {
      id: 'multi_head',
      type: 'concept',
      label: '多头注意力',
      description: '并行运行多个注意力头，每个头关注不同的表示子空间',
      x: 600,
      y: 170
    },
    {
      id: 'pos_encoding',
      type: 'concept',
      label: '位置编码',
      description: '为序列注入位置信息，使模型能够区分不同位置的 token',
      x: 400,
      y: 170
    },
    {
      id: 'rnn_limit',
      type: 'problem',
      label: 'RNN 并行化限制',
      description: '循环神经网络必须按顺序计算，无法充分利用并行硬件',
      x: 160,
      y: 300
    },
    {
      id: 'long_range',
      type: 'problem',
      label: '长距离依赖',
      description: 'RNN 在处理长序列时难以保持远距离 token 之间的有效信息传递',
      x: 640,
      y: 300
    },
    {
      id: 'scaled_dot_product',
      type: 'method',
      label: '缩放点积注意力',
      description: '核心计算模块：Q·K^T/√dk → Softmax → ×V',
      x: 200,
      y: 430
    },
    {
      id: 'encoder_decoder',
      type: 'method',
      label: '编码器-解码器架构',
      description: '编码器处理输入序列，解码器生成输出序列，两者均基于自注意力',
      x: 600,
      y: 430
    },
    {
      id: 'attention_formula',
      type: 'formula',
      label: 'Attention(Q,K,V)',
      description: 'Attention(Q,K,V) = softmax(QK^T/√dk)V，其中 Q、K、V 分别为查询、键、值矩阵',
      x: 400,
      y: 550
    },
    {
      id: 'wmt_translation',
      type: 'experiment',
      label: 'WMT 翻译实验',
      description: '在 WMT 2014 英德和英法翻译任务上达到 SOTA，BLEU 分数显著提升',
      x: 250,
      y: 670
    },
    {
      id: 'ablation_study',
      type: 'experiment',
      label: '消融实验',
      description: '验证注意力头数、模型维度、dropout 等超参数的影响',
      x: 550,
      y: 670
    },
    {
      id: 'quadratic_complexity',
      type: 'limitation',
      label: '二次复杂度',
      description: '自注意力的计算和内存复杂度为 O(n²)，限制了对超长序列的处理能力',
      x: 400,
      y: 780
    }
  ],
  edges: [
    {
      id: 'e1',
      sourceId: 'transformer',
      targetId: 'self_attention',
      label: '核心机制',
      directed: true
    },
    {
      id: 'e2',
      sourceId: 'transformer',
      targetId: 'multi_head',
      label: '关键设计',
      directed: true
    },
    {
      id: 'e3',
      sourceId: 'transformer',
      targetId: 'pos_encoding',
      label: '位置信息',
      directed: true
    },
    {
      id: 'e4',
      sourceId: 'rnn_limit',
      targetId: 'scaled_dot_product',
      label: '解决',
      directed: true
    },
    {
      id: 'e5',
      sourceId: 'long_range',
      targetId: 'scaled_dot_product',
      label: '解决',
      directed: true
    },
    {
      id: 'e6',
      sourceId: 'self_attention',
      targetId: 'scaled_dot_product',
      label: '实现',
      directed: true
    },
    {
      id: 'e7',
      sourceId: 'multi_head',
      targetId: 'encoder_decoder',
      label: '组成',
      directed: true
    },
    {
      id: 'e8',
      sourceId: 'scaled_dot_product',
      targetId: 'attention_formula',
      label: '公式化',
      directed: true
    },
    {
      id: 'e9',
      sourceId: 'encoder_decoder',
      targetId: 'wmt_translation',
      label: '验证',
      directed: true
    },
    {
      id: 'e10',
      sourceId: 'scaled_dot_product',
      targetId: 'ablation_study',
      label: '分析',
      directed: true
    },
    {
      id: 'e11',
      sourceId: 'multi_head',
      targetId: 'ablation_study',
      label: '分析',
      directed: true
    },
    {
      id: 'e12',
      sourceId: 'scaled_dot_product',
      targetId: 'quadratic_complexity',
      label: '固有缺陷',
      directed: true
    },
    {
      id: 'e13',
      sourceId: 'rnn_limit',
      targetId: 'encoder_decoder',
      label: '替代',
      directed: true
    },
    {
      id: 'e14',
      sourceId: 'pos_encoding',
      targetId: 'scaled_dot_product',
      label: '增强',
      directed: true
    }
  ]
}
