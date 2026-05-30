import { usePaper } from '../domains/paper/usePaper'
import MathText from './MathText'

function ArgumentChainView() {
  const { paperInsight } = usePaper()

  return (
    <div className="workspace-placeholder-view">
      <span className="eyebrow">Argument Chain</span>
      <h3>论文论证链理解</h3>
      {paperInsight ? (
        <div className="workspace-insight-stack">
          <article><strong>Central Insight</strong><p><MathText text={paperInsight.centralInsight} /></p></article>
          <article><strong>Prior Limitation</strong><p><MathText text={paperInsight.priorLimitation} /></p></article>
          <article><strong>Evidence Chain</strong><p>{paperInsight.evidenceChain.join(' → ')}</p></article>
          <article><strong>Remaining Gap</strong><p><MathText text={paperInsight.remainingGap} /></p></article>
        </div>
      ) : <p>分析论文后，这里会显示 central insight、prior limitation、evidence chain 和 remaining gap。</p>}
    </div>
  )
}

export default ArgumentChainView
