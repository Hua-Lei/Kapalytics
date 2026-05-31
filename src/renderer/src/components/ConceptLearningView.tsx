import type { ConceptLearningView as ConceptLearningViewType } from '../../../shared/kg4'

interface Props {
  concept: ConceptLearningViewType
  nodeLabel: string
}

export function ConceptLearningView({ concept }: Props) {
  return (
    <section className="concept-learning-view">
      <span className="eyebrow">Concept Teaching</span>
      <h3>{concept.title}</h3>

      <section className="concept-learning-view__grid">
        <article className="concept-card concept-card--quick">
          <h4>Quick Understanding</h4>
          <div className="concept-card__block">
            <strong>直觉 / Intuition</strong>
            <p>{concept.quickExplanation.intuition}</p>
          </div>
          <div className="concept-card__block">
            <strong>解决什么问题</strong>
            <p>{concept.quickExplanation.problemSolved}</p>
          </div>
          <div className="concept-card__block">
            <strong>核心机制</strong>
            <p>{concept.quickExplanation.coreMechanism}</p>
          </div>
          <div className="concept-card__block">
            <strong>适用场景</strong>
            <p>{concept.quickExplanation.whenToUse}</p>
          </div>
        </article>

        <article className="concept-card concept-card--formal">
          <h4>Formal View</h4>
          {concept.formalExplanation.definition ? (
            <div className="concept-card__block">
              <strong>定义</strong>
              <p>{concept.formalExplanation.definition}</p>
            </div>
          ) : null}
          {concept.formalExplanation.formulas.map((formula, idx) => (
            <div className="concept-card__block concept-card__formula" key={idx}>
              <code>{formula.latex}</code>
              <p>{formula.explanation}</p>
              {formula.variables.length ? (
                <table className="concept-card__variables">
                  <tbody>
                    {formula.variables.map((v) => (
                      <tr key={v.symbol}>
                        <td><code>{v.symbol}</code></td>
                        <td>{v.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          ))}
          {concept.formalExplanation.assumptions.length ? (
            <div className="concept-card__block">
              <strong>假设条件</strong>
              <ul>
                {concept.formalExplanation.assumptions.map((a, idx) => <li key={idx}>{a}</li>)}
              </ul>
            </div>
          ) : null}
        </article>

        {concept.misconceptions && concept.misconceptions.length ? (
          <article className="concept-card concept-card--misconceptions">
            <h4>常见误区</h4>
            {concept.misconceptions.map((m, idx) => (
              <div className="concept-card__block concept-card__misconception" key={idx}>
                <strong>{m.misconception}</strong>
                <p>{m.correction}</p>
              </div>
            ))}
          </article>
        ) : null}

        {concept.relationMap && concept.relationMap.length ? (
          <article className="concept-card concept-card--relations">
            <h4>Related Concepts</h4>
            {concept.relationMap.map((r, idx) => (
              <div className="concept-card__block" key={idx}>
                <span className="concept-card__relation-tag">{r.relation}</span>
                <strong>{r.label}</strong>
                <p>{r.explanation}</p>
              </div>
            ))}
          </article>
        ) : null}

        <article className="concept-card concept-card--papers">
          <h4>Papers</h4>
          {concept.representativePaperIds && concept.representativePaperIds.length ? (
            <div className="concept-card__block">
              <strong>代表论文</strong>
              <p>{concept.representativePaperIds.length} 篇</p>
            </div>
          ) : null}
          {concept.recentPaperIds && concept.recentPaperIds.length ? (
            <div className="concept-card__block">
              <strong>近期相关论文</strong>
              <p>{concept.recentPaperIds.length} 篇</p>
            </div>
          ) : null}
        </article>

        {concept.missingDataReasons && concept.missingDataReasons.length ? (
          <article className="concept-card concept-card--missing">
            <h4>Missing</h4>
            <ul>
              {concept.missingDataReasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
            </ul>
          </article>
        ) : null}
      </section>
    </section>
  )
}
