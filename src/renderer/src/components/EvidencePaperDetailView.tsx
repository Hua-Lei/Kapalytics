import { useExpansion } from '../domains/expansion/useExpansion'
import { useWorkspace } from '../domains/workspace/useWorkspace'

function EvidencePaperDetailView() {
  const { activeTab } = useWorkspace()
  const { sessions } = useExpansion()

  const session = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined
  const digest = session?.expansionRecord?.paperMethodDigests?.find(
    (item) => item.paperId === activeTab?.nodeId || item.id === activeTab?.nodeId
  )
  const relatedNode = session?.expansionRecord?.expansionGraphNodes.find(
    (node) => node.id === activeTab?.nodeId || node.sourcePaperIds.includes(activeTab?.nodeId ?? '')
  )

  if (!session || (!digest && !relatedNode)) {
    return (
      <div className="workspace-placeholder-view">
        <span className="eyebrow">Evidence Paper Detail</span>
        <h3>找不到证据论文详情</h3>
        <p>请先从 Expansion Graph View 选择一个关联论文节点，再查看这里的摘要与方法线索。</p>
      </div>
    )
  }

  if (!digest && relatedNode) {
    const recommendation = session?.expansionRecord?.relatedPaperRecommendations?.find(
      (item) => item.paperId === activeTab?.nodeId || relatedNode.sourcePaperIds.includes(item.paperId)
    )
    return (
      <div className="expand-view kg4-workbench evidence-paper-detail">
        <section className="expand-view__hero">
          <div>
            <span className="eyebrow">Related Paper Detail</span>
            <h3>{relatedNode.label}</h3>
            <p>{recommendation?.whyRecommended ?? relatedNode.description}</p>
          </div>
        </section>

        <section className="evidence-detail-grid">
          <article>
            <span className="node-expansion__label">Why Recommended</span>
            <p>{recommendation?.whyRecommended ?? '这篇论文与当前展开节点相关。'}</p>
          </article>
          <article>
            <span className="node-expansion__label">Understanding</span>
            <p>{recommendation?.relevanceSummary ?? '当前节点与这篇论文存在关联，但缺少结构化方法摘要。'}</p>
          </article>
          <article>
            <span className="node-expansion__label">Evidence and Limits</span>
            <p>当前只有检索元数据或摘要级信息，具体实验结论需要打开原文确认。</p>
          </article>
          <article>
            <span className="node-expansion__label">Read Next</span>
            <p><strong>Source Paper IDs</strong>: {relatedNode.sourcePaperIds.length ? relatedNode.sourcePaperIds.join(', ') : '暂无'}</p>
          </article>
        </section>
      </div>
    )
  }
  const recommendation = session?.expansionRecord?.relatedPaperRecommendations?.find(
    (item) => item.paperId === digest?.paperId
  )

  if (!digest) return null

  return (
    <div className="expand-view kg4-workbench evidence-paper-detail">
      <section className="expand-view__hero">
        <div>
          <span className="eyebrow">Evidence Paper Detail</span>
          <h3>{digest.paperTitle}</h3>
          <p>{recommendation?.whyRecommended ?? digest.evidenceSummary}</p>
        </div>
      </section>

      <section className="evidence-detail-grid">
        <article>
          <span className="node-expansion__label">Why Recommended</span>
          <p>{recommendation?.whyRecommended ?? '这篇论文被当前节点的方法摘要引用。'}</p>
          {recommendation?.qualitySignal?.badges.length ? <p><strong>Badges</strong>: {recommendation.qualitySignal.badges.join(', ')}</p> : null}
        </article>
        <article>
          <span className="node-expansion__label">Understanding</span>
          {digest.methodName ? <p><strong>Method</strong>: {digest.methodName}</p> : null}
          <p><strong>Problem Setting</strong>: {digest.problemSetting}</p>
          <p><strong>Core Mechanism</strong>: {digest.coreMechanism}</p>
          {digest.claimedImprovement ? <p><strong>Claimed Improvement</strong>: {digest.claimedImprovement}</p> : null}
        </article>
        <article>
          <span className="node-expansion__label">Evidence and Limits</span>
          <p>{digest.evidenceSummary}</p>
          {digest.limitation ? <p><strong>Limitation</strong>: {digest.limitation}</p> : null}
          {digest.insufficientInformation ? <p><strong>Missing</strong>: {digest.insufficientInformation}</p> : null}
        </article>
        <article>
          <span className="node-expansion__label">Read Next</span>
          <p><strong>Relation Hints</strong>: {digest.relationHints.length ? digest.relationHints.join(', ') : '暂无'}</p>
          <p>可以回到方法谱系查看它对应的 foundation、variant 或 improvement 位置。</p>
        </article>
      </section>
    </div>
  )
}

export default EvidencePaperDetailView
