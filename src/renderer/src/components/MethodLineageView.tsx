import type { MethodLineageNodeRole, MethodLineageView as MethodLineageViewType } from '../../../shared/kg4'
import MathText from './MathText'

const ROLE_LABELS: Record<MethodLineageNodeRole, string> = {
  current_method: '当前方法',
  foundation_method: '奠基方法',
  parallel_variant: '并行变体',
  improvement: '改进路线',
  application_variant: '应用变体',
  open_problem: '开放问题'
}

export function MethodLineageView({ lineage }: { lineage: MethodLineageViewType }) {
  return (
    <section className="method-lineage-view expansion-reading-note">
      <section className="method-lineage-section method-lineage-section--summary">
        <span className="eyebrow">谱系/演进图</span>
        <h3>{lineage.title}</h3>
        <p><MathText text={lineage.summary} /></p>
      </section>

      {lineage.readingOrder.length ? (
        <section className="method-lineage-section method-lineage-section--order">
          <h4>推荐阅读顺序</h4>
          <ol className="method-lineage-order">
            {lineage.readingOrder.map((item) => <li key={item}><MathText text={item} /></li>)}
          </ol>
        </section>
      ) : null}

      <section className="method-lineage-section method-lineage-section--nodes">
        <h4>方法谱系节点</h4>
        <div className="method-lineage-node-list">
          {lineage.nodes.map((node) => (
            <article className={`method-lineage-node method-lineage-node--${node.role}`} key={node.id}>
              <span>{ROLE_LABELS[node.role]}</span>
              <strong>{node.label}</strong>
              <p><MathText text={node.summary} /></p>
              {node.representativePaperIds.length ? <em>{node.representativePaperIds.length} 篇代表论文</em> : null}
            </article>
          ))}
        </div>
      </section>

      {lineage.edges.length ? (
        <section className="method-lineage-section method-lineage-section--edges">
          <h4>演化关系</h4>
          <div className="method-lineage-edge-list">
            {lineage.edges.map((edge) => {
              const source = lineage.nodes.find((node) => node.id === edge.sourceId)
              const target = lineage.nodes.find((node) => node.id === edge.targetId)
              return (
                <article className="method-lineage-edge" key={edge.id}>
                  <strong>{source?.label ?? edge.sourceId} {'->'} {target?.label ?? edge.targetId}</strong>
                  <span>{edge.relation.replace(/_/g, ' ')} · {Math.round(edge.confidence * 100)}%</span>
                  <p><MathText text={edge.explanation} /></p>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {lineage.openQuestions.length ? (
        <section className="method-lineage-section method-lineage-section--questions">
          <h4>Open Questions</h4>
          <ul>
            {lineage.openQuestions.map((question) => <li key={question}><MathText text={question} /></li>)}
          </ul>
        </section>
      ) : null}
    </section>
  )
}
