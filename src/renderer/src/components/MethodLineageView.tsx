import type { MethodLineageEvidenceRef, MethodLineageNodeRole, MethodLineageView as MethodLineageViewType, PdfEvidenceRef } from '../../../shared/kg4'
import MathText from './MathText'

const ROLE_LABELS: Record<MethodLineageNodeRole, string> = {
  current_method: '当前方法',
  foundation_method: '奠基方法',
  parallel_variant: '并行变体',
  improvement: '改进路线',
  application_variant: '应用变体',
  open_problem: '开放问题'
}

function PdfEvidenceCard({ evidence }: { evidence: PdfEvidenceRef }) {
  return (
    <aside className="method-lineage-evidence-card">
      <span>{evidence.sectionTitle ? `${evidence.sectionTitle} · Page ${evidence.pageNumber ?? '?'}` : `Page ${evidence.pageNumber ?? '?'}`}</span>
      <blockquote>{evidence.excerpt}</blockquote>
      <p>{evidence.claimSupported}</p>
    </aside>
  )
}

function EvidenceItem({ evidence }: { evidence: MethodLineageEvidenceRef }) {
  if (evidence.sourceType === 'current_pdf') return <PdfEvidenceCard evidence={evidence} />
  if (evidence.sourceType === 'model_knowledge') {
    return (
      <aside className="method-lineage-evidence-card method-lineage-evidence-card--soft">
        <span>model_knowledge · {Math.round(evidence.confidence * 100)}%</span>
        <p>{evidence.note}</p>
      </aside>
    )
  }
  return (
    <aside className="method-lineage-evidence-card method-lineage-evidence-card--soft">
      <span>future_retrieval_needed</span>
      <p>{evidence.reason}</p>
    </aside>
  )
}

export function MethodLineageView({ lineage }: { lineage: MethodLineageViewType }) {
  return (
    <section className="method-lineage-view expansion-reading-note">
      <section className="method-lineage-section method-lineage-section--summary">
        <span className="eyebrow">谱系/演进图</span>
        <h3>{lineage.title}</h3>
        <p><MathText text={lineage.summary} /></p>
      </section>

      {lineage.problemSetup ? (
        <section className="method-lineage-section method-lineage-section--summary">
          <h4>问题背景</h4>
          <p><MathText text={lineage.problemSetup.beginnerExplanation} /></p>
          <p><MathText text={lineage.problemSetup.whyThisProblemMatters} /></p>
          {lineage.problemSetup.pdfEvidence.length ? (
            <div className="method-lineage-evidence-list">
              <span className="eyebrow">PDF 原文证据</span>
              {lineage.problemSetup.pdfEvidence.map((evidence, index) => <PdfEvidenceCard evidence={evidence} key={`${evidence.pageNumber ?? 'p'}-${index}`} />)}
            </div>
          ) : null}
        </section>
      ) : null}

      {lineage.anchorPosition ? (
        <section className="method-lineage-section method-lineage-section--nodes">
          <h4>当前论文的位置</h4>
          <p><MathText text={lineage.anchorPosition.summary} /></p>
          <p><MathText text={lineage.anchorPosition.whatTheCurrentPaperChanges} /></p>
          {lineage.anchorPosition.whatItInherits.length ? (
            <ul>{lineage.anchorPosition.whatItInherits.map((item) => <li key={item}><MathText text={item} /></li>)}</ul>
          ) : null}
          {lineage.anchorPosition.whatItDoesNotSolve.length ? (
            <ul>{lineage.anchorPosition.whatItDoesNotSolve.map((item) => <li key={item}><MathText text={item} /></li>)}</ul>
          ) : null}
          {lineage.anchorPosition.pdfEvidence.length ? (
            <div className="method-lineage-evidence-list">
              <span className="eyebrow">PDF 原文证据</span>
              {lineage.anchorPosition.pdfEvidence.map((evidence, index) => <PdfEvidenceCard evidence={evidence} key={`${evidence.pageNumber ?? 'p'}-${index}`} />)}
            </div>
          ) : null}
        </section>
      ) : null}

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
              {node.evidence?.length ? (
                <div className="method-lineage-evidence-list">
                  {node.evidence.map((evidence, index) => <EvidenceItem evidence={evidence} key={index} />)}
                </div>
              ) : null}
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
                  {edge.evidence?.length ? (
                    <div className="method-lineage-evidence-list">
                      {edge.evidence.map((evidence, index) => <EvidenceItem evidence={evidence} key={index} />)}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {lineage.methodComparisons?.length ? (
        <section className="method-lineage-section method-lineage-section--edges">
          <h4>关键方法对比</h4>
          <div className="method-lineage-edge-list">
            {lineage.methodComparisons.map((comparison) => (
              <article className="method-lineage-edge" key={`${comparison.methodA}-${comparison.methodB}`}>
                <strong>{comparison.methodA} {'->'} {comparison.methodB}</strong>
                <p><MathText text={comparison.keyDifference} /></p>
                <p><MathText text={comparison.whyItMatters} /></p>
                {comparison.evidence.length ? (
                  <div className="method-lineage-evidence-list">
                    {comparison.evidence.map((evidence, index) => <EvidenceItem evidence={evidence} key={index} />)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {lineage.confidenceAndEvidence ? (
        <section className="method-lineage-section method-lineage-section--questions">
          <h4>证据边界</h4>
          <p>PDF: {lineage.confidenceAndEvidence.groundedInCurrentPdf.join(' / ') || '无'}</p>
          <p>Model: {lineage.confidenceAndEvidence.fromModelKnowledge.join(' / ') || '无'}</p>
          <p>Retrieval: {lineage.confidenceAndEvidence.needsFutureRetrieval.join(' / ') || '无'}</p>
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
