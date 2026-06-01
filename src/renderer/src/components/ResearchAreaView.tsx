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

      <article className="research-area-view__article expansion-reading-note">
        <section className="ra-section ra-section--overview">
          <h4>Overview</h4>
          <p>{area.overview}</p>
        </section>

        {area.keyProblems.length ? (
          <section className="ra-section ra-section--problems">
            <h4>Key Problems</h4>
            <ul>
              {area.keyProblems.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </section>
        ) : null}

        {area.methodFamilies.length ? (
          <section className="ra-section ra-section--family">
            <h4>Method Families</h4>
            <div className="ra-section__stack">
              {area.methodFamilies.map((family, i) => (
                <div className="ra-section__item" key={i}>
                  <strong>{family.label}</strong>
                  <p>{family.summary}</p>
                  {family.representativePaperIds.length ? (
                    <p className="ra-card__papers">{family.representativePaperIds.length} 篇代表论文</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {area.recentHotDirections.length ? (
          <section className="ra-section ra-section--hot">
            <h4>Recent Hot Directions</h4>
            <div className="ra-section__stack">
              {area.recentHotDirections.map((direction, i) => (
                <div className="ra-section__item" key={i}>
                  <div className="ra-section__item-title">
                    <strong>{direction.label}</strong>
                    <span className="ra-card__confidence">{(direction.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p>{direction.summary}</p>
                  {direction.paperIds.length ? (
                    <p className="ra-card__papers">{direction.paperIds.length} 篇论文</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {area.recommendedReading.length ? (
          <section className="ra-section ra-section--reading">
            <h4>Recommended Reading</h4>
            {area.recommendedReading.map((reading, i) => (
              <div className="ra-card__reading-item" key={i}>
                <span className="ra-card__role-badge">{ROLE_BADGES[reading.role] ?? reading.role}</span>
                <span className="ra-card__reading-reason">{reading.reason}</span>
              </div>
            ))}
          </section>
        ) : null}
      </article>
    </section>
  )
}
