import type { ResearchAreaView as ResearchAreaViewType } from '../../../shared/kg4'

interface Props {
  area: ResearchAreaViewType
  nodeLabel: string
}

const ROLE_BADGES: Record<string, string> = {
  survey: '综述',
  foundation: '奠基',
  recent_hot: '热点',
  representative: '代表',
  needs_review: '待审'
}

export function ResearchAreaView({ area }: Props) {
  return (
    <section className="research-area-view">
      <span className="eyebrow">Research Area Map</span>
      <h3>{area.title}</h3>

      <section className="research-area-view__grid">
        <article className="ra-card ra-card--overview">
          <h4>Overview</h4>
          <p>{area.overview}</p>
        </article>

        {area.keyProblems.length ? (
          <article className="ra-card ra-card--problems">
            <h4>Key Problems</h4>
            <ul>
              {area.keyProblems.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </article>
        ) : null}

        {area.methodFamilies.map((family, i) => (
          <article className="ra-card ra-card--family" key={i}>
            <h4>{family.label}</h4>
            <p>{family.summary}</p>
            {family.representativePaperIds.length ? (
              <p className="ra-card__papers">{family.representativePaperIds.length} 篇代表论文</p>
            ) : null}
          </article>
        ))}

        {area.recentHotDirections.map((direction, i) => (
          <article className="ra-card ra-card--hot" key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>{direction.label}</h4>
              <span className="ra-card__confidence">{(direction.confidence * 100).toFixed(0)}%</span>
            </div>
            <p>{direction.summary}</p>
            {direction.paperIds.length ? (
              <p className="ra-card__papers">{direction.paperIds.length} 篇论文</p>
            ) : null}
          </article>
        ))}

        {area.recommendedReading.length ? (
          <article className="ra-card ra-card--reading">
            <h4>Recommended Reading</h4>
            {area.recommendedReading.map((reading, i) => (
              <div className="ra-card__reading-item" key={i}>
                <span className="ra-card__role-badge">{ROLE_BADGES[reading.role] ?? reading.role}</span>
                <span className="ra-card__reading-reason">{reading.reason}</span>
              </div>
            ))}
          </article>
        ) : null}
      </section>
    </section>
  )
}
