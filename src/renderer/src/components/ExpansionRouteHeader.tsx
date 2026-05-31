import type { ExpansionNodeClassification, ExpansionPath, ExpansionPrimaryType } from '../../../shared/kg4'

const TYPE_LABELS: Record<ExpansionPrimaryType, string> = {
  field: '领域',
  problem: '研究问题',
  concept: '核心概念',
  method: '算法/方法',
  paper: '论文证据',
  unknown: '未确定'
}

const PATH_LABELS: Record<ExpansionPath, string> = {
  learn_concept: '理解这个概念',
  track_method_lineage: '追踪方法谱系',
  explore_research_area: '探索研究方向',
  review_related_papers: '查看相关论文',
  inspect_paper_evidence: '检查论文证据'
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`
}

function fallbackClassification(nodeLabel: string): ExpansionNodeClassification {
  return {
    primaryType: 'unknown',
    facets: [],
    confidence: 0.3,
    rationale: `暂无「${nodeLabel}」的节点分类结果，先展示相关论文和可用证据。`,
    recommendedPath: 'review_related_papers',
    alternativePaths: ['learn_concept', 'track_method_lineage', 'explore_research_area']
  }
}

export function ExpansionRouteHeader({ classification, nodeLabel }: { classification?: ExpansionNodeClassification; nodeLabel: string }) {
  const resolved = classification ?? fallbackClassification(nodeLabel)

  return (
    <section className="expansion-route-header">
      <div className="expansion-route-header__main">
        <span className="eyebrow">Recommended Path</span>
        <h4>{PATH_LABELS[resolved.recommendedPath]}</h4>
        <p>{resolved.rationale}</p>
      </div>
      <div className="expansion-route-header__meta">
        <span className="expansion-route-header__type">{TYPE_LABELS[resolved.primaryType]}</span>
        <span className="expansion-route-header__confidence">Confidence {formatConfidence(resolved.confidence)}</span>
      </div>
      {resolved.facets.length ? (
        <div className="expansion-route-header__chips">
          {resolved.facets.map((facet) => <span key={facet}>{facet}</span>)}
        </div>
      ) : null}
      {resolved.alternativePaths.length ? (
        <div className="expansion-route-header__paths">
          <strong>Other paths</strong>
          {resolved.alternativePaths.map((path) => <span key={path}>{PATH_LABELS[path]}</span>)}
        </div>
      ) : null}
      {resolved.ambiguity ? (
        <p className="expansion-route-header__ambiguity">可能也像「{TYPE_LABELS[resolved.ambiguity.competingType]}」：{resolved.ambiguity.reason}</p>
      ) : null}
    </section>
  )
}
