import { useEffect, useState } from 'react'
import { useExpansion } from '../domains/expansion/useExpansion'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import type { NodeExpansionSession } from '../domains/expansion/nodeExpansionSessions'
import { buildExpansionLoadingTelemetry } from '../domains/expansion/loadingTelemetry'

const STATUS_LABEL: Record<NodeExpansionSession['status'], string> = {
  loading: 'Loading',
  ready: 'Ready',
  failed: 'Failed',
  empty: 'Empty'
}

function ExpansionLoadingView() {
  const { activeTab, openTab, updateTabStatus } = useWorkspace()
  const { sessions, startExpansion } = useExpansion()
  const session = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    if (!session) return
    updateTabStatus(session.id, session.status)
  }, [session?.id, session?.status, updateTabStatus])

  useEffect(() => {
    if (session?.status !== 'loading') return
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session?.status])

  if (!session) {
    return (
      <div className="workspace-placeholder-view expansion-loading-view expansion-loading-view--empty">
        <span className="eyebrow">Node Expansion</span>
        <h3>找不到展开任务</h3>
        <p>该 workspace tab 没有关联的 expansion session。可以回到 Paper Graph 重新点击可展开节点。</p>
      </div>
    )
  }

  const telemetry = buildExpansionLoadingTelemetry(session, nowMs)
  const { currentStep, completedStepCount, candidateCount, digestCount, expansionNodeCount, elapsedTime } = telemetry

  const openExpansionGraph = () => {
    openTab({
      id: session.id,
      type: 'expansion_graph',
      title: `Expansion Graph: ${session.nodeLabel}`,
      nodeId: session.nodeId,
      expansionId: session.id,
      closable: true,
      status: 'ready'
    })
  }

  const retryExpansion = async () => {
    const result = await startExpansion(session.nodeId, { forceRefresh: true })
    if (!result) return
    openTab({
      id: result.sessionId,
      type: 'node_expansion_loading',
      title: `Expand: ${session.nodeLabel}`,
      nodeId: session.nodeId,
      expansionId: result.sessionId,
      closable: true,
      status: 'loading'
    })
  }

  return (
    <div className={`expansion-loading-view expansion-loading-view--${session.status}`}>
      <section className="expansion-loading-hero">
        <div>
          <span className="eyebrow">Node Expansion Loading View</span>
          <h3>正在展开：{session.nodeLabel}</h3>
          <p>{currentStep?.detail ?? '正在调度检索、摘要和谱系生成任务...'}</p>
        </div>
        <span className={`expansion-status expansion-status--${session.status}`}>{STATUS_LABEL[session.status]}</span>
      </section>

      <section className="expansion-loading-summary">
        <article>
          <span>Current step</span>
          <strong>{currentStep?.label ?? STATUS_LABEL[session.status]}</strong>
        </article>
        <article>
          <span>Elapsed</span>
          <strong>{elapsedTime}</strong>
        </article>
        <article>
          <span>Candidate papers</span>
          <strong>{candidateCount}</strong>
        </article>
        <article>
          <span>Method digests</span>
          <strong>{digestCount}</strong>
        </article>
        <article>
          <span>Temporary nodes</span>
          <strong>{expansionNodeCount}</strong>
        </article>
      </section>

      {session.status === 'loading' && (
        <section className="expansion-loading-progress-note">
          <strong>{completedStepCount}/{session.steps.length} steps completed</strong>
          <p>长输出任务可能需要更久；页面会在检索、摘要和谱系汇总完成后自动切换到结果。</p>
        </section>
      )}

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
          <button className="stage-btn stage-btn--primary" onClick={openExpansionGraph}>查看 Expansion Graph</button>
          <button className="stage-btn stage-btn--secondary" onClick={retryExpansion}>重新检索分析</button>
        </section>
      )}

      {(session.status === 'failed' || session.status === 'empty') && (
        <section className="expansion-loading-error">
          <strong>{session.status === 'empty' ? '没有可展示的展开结果' : '展开任务失败'}</strong>
          <p>{session.errorMessage ?? '当前没有更多错误信息。'}</p>
          <button className="stage-btn stage-btn--primary" onClick={retryExpansion}>重新检索分析</button>
        </section>
      )}
    </div>
  )
}

export default ExpansionLoadingView
