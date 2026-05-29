import { useState } from 'react'
import type { GraphNode, NodeExpansionResult, PaperInsight } from '../../../shared/paper'
import { expandNode } from '../modules/learning/nodeExpansion'
import { canExpandGraphNode } from '../modules/paper/analysisState'
import MathText from './MathText'

interface NodeDetailPanelProps {
  node: GraphNode | null
  paperInsight: PaperInsight | null
  onAdoptTransferTask: (prompt: string) => void
}

const typeLabel: Record<string, string> = {
  field: '领域',
  concept: '核心概念',
  problem: '研究问题',
  method: '方法模块',
  formula: '公式算法',
  experiment: '实验',
  limitation: '局限'
}

const color: Record<string, string> = {
  field: '#315c72',
  concept: '#4e6f5b',
  problem: '#8f574f',
  method: '#5b5f86',
  formula: '#76617f',
  experiment: '#52737a',
  limitation: '#8a7045'
}

function DetailList({ title, items }: { title: string; items: unknown }) {
  const list = Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : []
  if (!list.length) return null
  return (
    <section className="node-detail__section">
      <h4>{title}</h4>
      <ul className="node-detail__list">
        {list.map((item, index) => <li key={`${title}-${index}`}><MathText text={item} /></li>)}
      </ul>
    </section>
  )
}

function LabeledText({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="node-detail__field">
      <span className="node-detail__field-label">{label}</span>
      <span className="node-detail__field-value"><MathText text={value} /></span>
    </div>
  )
}

function TypeStructuredDetail({ node }: { node: GraphNode }) {
  const detail = node.detail
  const methodFlow = Array.isArray(detail?.methodFlow) ? detail.methodFlow : []
  const formulaSymbols = Array.isArray(detail?.formulaExplanation?.symbols)
    ? detail.formulaExplanation.symbols
    : []
  const claimEvidence = Array.isArray(detail?.claimEvidence) ? detail.claimEvidence : []
  const failureConditions = Array.isArray(detail?.failureConditions) ? detail.failureConditions : []

  if (node.type === 'method' && methodFlow.length) {
    return (
      <section className="node-detail__section">
        <h4>方法流程</h4>
        <div className="method-flow">
          {methodFlow.map((step, index) => (
            <div className="method-flow__step" key={step.id || index}>
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <p><MathText text={step.description} /></p>
              {step.input && <em>输入：{step.input}</em>}
              {step.output && <em>输出：{step.output}</em>}
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (node.type === 'formula' && detail?.formulaExplanation) {
    const formula = detail.formulaExplanation
    return (
      <section className="node-detail__section">
        <h4>公式拆解</h4>
        <div className="formula-box"><MathText text={formula.latex || node.description} /></div>
        {formulaSymbols.length > 0 && (
          <table className="node-detail__table">
            <thead><tr><th>符号</th><th>含义</th></tr></thead>
            <tbody>{formulaSymbols.map((row) => <tr key={row.symbol}><td>{row.symbol}</td><td>{row.meaning}</td></tr>)}</tbody>
          </table>
        )}
        <LabeledText label="训练目标" value={formula.trainingObjective} />
        <LabeledText label="方法位置" value={formula.positionInMethod} />
        <LabeledText label="去掉/改变的影响" value={formula.ablationThought} />
      </section>
    )
  }

  if (node.type === 'experiment' && claimEvidence.length) {
    return (
      <section className="node-detail__section">
        <h4>Claim-Evidence</h4>
        <table className="node-detail__table">
          <thead><tr><th>实验</th><th>验证 claim</th><th>观察结果</th><th>结论</th></tr></thead>
          <tbody>
            {claimEvidence.map((row, index) => (
              <tr key={`${row.experiment}-${index}`}>
                <td>{row.experiment}</td>
                <td>{row.claim}</td>
                <td>{row.observation}</td>
                <td>{row.conclusion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  }

  if (node.type === 'limitation') {
    return <DetailList title="失败条件" items={failureConditions} />
  }

  return <DetailList title="关键点" items={detail?.keyPoints} />
}

function ExpansionCard({ expansion, onAdoptTransferTask }: { expansion: NodeExpansionResult; onAdoptTransferTask: (prompt: string) => void }) {
  return (
    <section className="node-detail__section expansion-card">
      <div className="source-note">当前版本使用内置候选论文库，不由 LLM 编造相关论文。</div>
      <h4>{expansion.overview.title}</h4>
      <p><MathText text={expansion.overview.definition} /></p>
      <DetailList title="核心问题" items={expansion.overview.coreProblems} />
      <DetailList title="方法类别" items={expansion.overview.methodFamilies} />
      <DetailList title="继续检索关键词" items={expansion.overview.keyTerms} />

      <h4>代表论文</h4>
      {expansion.relatedPapers.length ? (
        <div className="related-paper-list">
          {expansion.relatedPapers.map((paper) => (
            <article className="related-paper" key={paper.id}>
              <strong>{paper.title}</strong>
              <span>{[paper.authors?.join(', '), paper.year, paper.venue].filter(Boolean).join(' · ')}</span>
              <p>{paper.summary}</p>
            </article>
          ))}
        </div>
      ) : <p className="node-detail__muted">当前内置论文库暂无相关条目。</p>}

      {expansion.methodEvolution?.length ? (
        <div className="method-evolution">
          <h4>方法演进</h4>
          {expansion.methodEvolution.map((step) => (
            <div key={step.id} className="method-evolution__step">
              <strong>{step.label}</strong>
              <span>{step.relation}</span>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      ) : null}

      {expansion.comparisonRows?.length ? (
        <>
          <h4>当前论文 vs 代表论文</h4>
          <table className="node-detail__table">
            <thead><tr><th>维度</th><th>当前论文</th><th>代表论文</th></tr></thead>
            <tbody>
              {expansion.comparisonRows.map((row) => (
                <tr key={row.dimension}><td>{row.dimension}</td><td>{row.currentPaper}</td><td>{row.relatedPaper}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {expansion.transferTask && (
        <div className="transfer-task-card">
          <span>迁移任务</span>
          <p><MathText text={expansion.transferTask.prompt} /></p>
          <button className="stage-btn stage-btn--primary" onClick={() => onAdoptTransferTask(expansion.transferTask!.prompt)}>
            接入学习闭环
          </button>
        </div>
      )}
    </section>
  )
}

function NodeDetailPanel({ node, paperInsight, onAdoptTransferTask }: NodeDetailPanelProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)

  if (!node) {
    return <div className="empty-state">点击图谱中的节点以查看详情</div>
  }

  const canExpand = canExpandGraphNode(node)
  const expansion = expandedNodeId === node.id ? expandNode(node, paperInsight) : null

  return (
    <div className="node-detail">
      <div className="node-detail__header">
        <span className="node-detail__type-badge" style={{ background: color[node.type] }}>
          {typeLabel[node.type]}
        </span>
        {canExpand && <span className="node-detail__expandable">可扩展</span>}
      </div>
      <h3 className="node-detail__title">{node.label}</h3>
      <p className="node-detail__description"><MathText text={node.detail?.summary || node.description} /></p>

      <section className="node-detail__section">
        <LabeledText label="关键洞察" value={node.insight} />
        <LabeledText label="为什么重要" value={node.whyImportant} />
        <LabeledText label="论文角色" value={node.roleInPaper} />
        <LabeledText label="相对已有方法" value={node.contrastWithPrior} />
        <LabeledText label="证据节点" value={node.evidenceNodeIds?.join(', ')} />
      </section>

      <TypeStructuredDetail node={node} />

      {canExpand && (
        <section className="node-detail__section">
          <h4>Node Expansion</h4>
          <p className="node-detail__muted">从当前节点进入领域概览、代表论文对比和迁移任务。</p>
          {node.searchQueries?.length ? <DetailList title="检索查询" items={node.searchQueries} /> : null}
          <button className="stage-btn stage-btn--primary" onClick={() => setExpandedNodeId(expandedNodeId === node.id ? null : node.id)}>
            {expandedNodeId === node.id ? '收起扩展' : '展开该方向'}
          </button>
        </section>
      )}

      {expansion && <ExpansionCard expansion={expansion} onAdoptTransferTask={onAdoptTransferTask} />}
    </div>
  )
}

export default NodeDetailPanel
