import { useExpansion } from '../domains/expansion/useExpansion'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import type { NodeExpansionSession } from '../domains/expansion/nodeExpansionSessions'

const STATUS_LABEL: Record<NodeExpansionSession['status'], string> = {
  loading: 'Loading',
  ready: 'Ready',
  failed: 'Failed',
  empty: 'Empty'
}

function ExpansionLoadingView() {
  const { activeTab } = useWorkspace()
  const { sessions } = useExpansion()
  const session = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined

  if (!session) {
    return (
      <div className="workspace-placeholder-view expansion-loading-view expansion-loading-view--empty">
        <span className="eyebrow">Node Expansion</span>
        <h3>找不到展开任务</h3>
        <p>该 workspace tab 没有关联的 expansion session。可以回到 Paper Graph 重新点击可展开节点。</p>
      </div>
    )
  }

  const candidateCount = session.expansionRecord?.retrievedPaperIds.length ?? 0
  const expansionNodeCount = session.expansionRecord?.expansionGraphNodes.length ?? 0

  return (
    <div className={`expansion-loading-view expansion-loading-view--${session.status}`}>
      <section className="expansion-loading-hero">
        <div>
          <span className="eyebrow">Node Expansion Loading View</span>
          <h3>正在展开：{session.nodeLabel}</h3>
          <p>通过 LLM 任务检索和分析相关论文，生成可展开的算法思想图谱。</p>
        </div>
        <span className={`expansion-status expansion-status--${session.status}`}>{STATUS_LABEL[session.status]}</span>
      </section>

      <section className="expansion-loading-summary">
        <article>
          <span>Provider</span>
          <strong>DeepSeek + local retrieval</strong>
        </article>
        <article>
          <span>Candidate papers</span>
          <strong>{candidateCount}</strong>
        </article>
        <article>
          <span>Temporary nodes</span>
          <strong>{expansionNodeCount}</strong>
        </article>
      </section>

      <section className="expansion-step-list" aria-label="Node expansion loading steps">
        {session.steps.map((step) => (
          <article className={`expansion-step expansion-step--${step.status}`} key={step.id}>
            <span className="expansion-step__dot" />
            <div>
              <strong>{step.label}</strong>
              {step.detail && <p>{step.detail}</p>}
            </div>
          </article>
        ))}
      </section>

      {session.status === 'ready' && (
        <section className="expansion-loading-note">
          <strong>展开完成</strong>
          <p>可以切换到 Expansion Graph View 查看扩展图谱。</p>
        </section>
      )}

      {(session.status === 'failed' || session.status === 'empty') && (
        <section className="expansion-loading-error">
          <strong>{session.status === 'empty' ? '没有可展示的展开结果' : '展开任务失败'}</strong>
          <p>{session.errorMessage ?? '当前没有更多错误信息。'}</p>
        </section>
      )}
    </div>
  )
}

export default ExpansionLoadingView
