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
    return (
      <div className="expand-view kg4-workbench">
        <section className="expand-view__hero">
          <div>
            <span className="eyebrow">Related Paper Detail</span>
            <h3>{relatedNode.label}</h3>
            <p>{relatedNode.description}</p>
          </div>
        </section>

        <section className="kg4-field-view">
          <span className="node-expansion__label">Generic Related Paper</span>
          <p><strong>Node Type</strong>: {relatedNode.type}</p>
          <p><strong>Source Paper IDs</strong>: {relatedNode.sourcePaperIds.length ? relatedNode.sourcePaperIds.join(', ') : '暂无'}</p>
        </section>
      </div>
    )
  }
  if (!digest) return null

  return (
    <div className="expand-view kg4-workbench">
      <section className="expand-view__hero">
        <div>
          <span className="eyebrow">Evidence Paper Detail</span>
          <h3>{digest.paperTitle}</h3>
          <p>{digest.evidenceSummary}</p>
        </div>
      </section>

      <section className="kg4-field-view">
        <span className="node-expansion__label">Method Snapshot</span>
        {digest.methodName ? <p><strong>Method</strong>: {digest.methodName}</p> : null}
        <p><strong>Problem Setting</strong>: {digest.problemSetting}</p>
        <p><strong>Core Mechanism</strong>: {digest.coreMechanism}</p>
        {digest.claimedImprovement ? <p><strong>Claimed Improvement</strong>: {digest.claimedImprovement}</p> : null}
        {digest.limitation ? <p><strong>Limitation</strong>: {digest.limitation}</p> : null}
        <p><strong>Relation Hints</strong>: {digest.relationHints.length ? digest.relationHints.join(', ') : '暂无'}</p>
      </section>
    </div>
  )
}

export default EvidencePaperDetailView
