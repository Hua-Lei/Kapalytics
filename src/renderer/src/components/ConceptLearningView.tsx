import type { ConceptLearningView as ConceptLearningViewType } from '../../../shared/kg4'
import MathText from './MathText'

interface Props {
  concept: ConceptLearningViewType
  nodeLabel: string
  onSelectPaper?: (paperId: string) => void
}

export function ConceptLearningView({ concept, onSelectPaper }: Props) {
  return (
    <section className="concept-learning-view">
      <span className="eyebrow">Concept Teaching</span>
      <h3>{concept.title}</h3>

      <article className="concept-learning-view__article expansion-reading-note">
        <section className="concept-section concept-section--quick">
          <h4>Quick Understanding</h4>
          <div className="concept-card__block">
            <strong>直觉 / Intuition</strong>
            <p><MathText text={concept.quickExplanation.intuition} /></p>
          </div>
          <div className="concept-card__block">
            <strong>解决什么问题</strong>
            <p><MathText text={concept.quickExplanation.problemSolved} /></p>
          </div>
          <div className="concept-card__block">
            <strong>核心机制</strong>
            <p><MathText text={concept.quickExplanation.coreMechanism} /></p>
          </div>
          <div className="concept-card__block">
            <strong>适用场景</strong>
            <p><MathText text={concept.quickExplanation.whenToUse} /></p>
          </div>
        </section>

        <section className="concept-section concept-section--formal">
          <h4>Formal View</h4>
          {concept.formalExplanation.definition ? (
            <div className="concept-card__block">
              <strong>定义</strong>
              <p><MathText text={concept.formalExplanation.definition} /></p>
            </div>
          ) : null}
          {concept.formalExplanation.formulas.map((formula, idx) => (
            <div className="concept-card__block concept-card__formula" key={idx}>
              <MathText text={formula.latex} displayMode />
              <p><MathText text={formula.explanation} /></p>
              {formula.variables.length ? (
                <table className="concept-card__variables">
                  <tbody>
                    {formula.variables.map((v) => (
                      <tr key={v.symbol}>
                        <td><MathText text={v.symbol} /></td>
                        <td><MathText text={v.meaning} /></td>
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
                {concept.formalExplanation.assumptions.map((a, idx) => <li key={idx}><MathText text={a} /></li>)}
              </ul>
            </div>
          ) : null}
        </section>

        {concept.misconceptions && concept.misconceptions.length ? (
          <section className="concept-section concept-section--misconceptions">
            <h4>常见误区</h4>
            {concept.misconceptions.map((m, idx) => (
              <div className="concept-card__block concept-card__misconception" key={idx}>
                <strong>{m.misconception}</strong>
                <p><MathText text={m.correction} /></p>
              </div>
            ))}
          </section>
        ) : null}

        {concept.relationMap && concept.relationMap.length ? (
          <section className="concept-section concept-section--relations">
            <h4>Related Concepts</h4>
            {concept.relationMap.map((r, idx) => (
              <div className="concept-card__block" key={idx}>
                <span className="concept-card__relation-tag">{r.relation}</span>
                <strong>{r.label}</strong>
                <p><MathText text={r.explanation} /></p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="concept-section concept-section--papers">
          <h4>Papers</h4>
          {concept.representativePaperIds && concept.representativePaperIds.length ? (
            <div className="concept-card__block">
              <strong>代表论文</strong>
              <div className="concept-card__paper-list">
                {concept.representativePaperIds.map((paperId) => (
                  <button
                    key={paperId}
                    className="concept-card__paper-link"
                    type="button"
                    onClick={() => onSelectPaper?.(paperId)}
                  >
                    {paperId}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {concept.recentPaperIds && concept.recentPaperIds.length ? (
            <div className="concept-card__block">
              <strong>近期相关论文</strong>
              <div className="concept-card__paper-list">
                {concept.recentPaperIds.map((paperId) => (
                  <button
                    key={paperId}
                    className="concept-card__paper-link"
                    type="button"
                    onClick={() => onSelectPaper?.(paperId)}
                  >
                    {paperId}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {concept.missingDataReasons && concept.missingDataReasons.length ? (
          <section className="concept-section concept-section--missing">
            <h4>Missing</h4>
            <ul>
              {concept.missingDataReasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
            </ul>
          </section>
        ) : null}
      </article>
    </section>
  )
}
