import type { AlgorithmIdeaCard } from '../../../../shared/kg4'
import TruncatedText from './TruncatedText'
import { useWorkspace } from '../../domains/workspace/useWorkspace'
import { useExpansion } from '../../domains/expansion/useExpansion'

function AlgorithmIdeaInspector({ card, expansionId }: {
  card: AlgorithmIdeaCard
  expansionId: string
}) {
  const { openTab } = useWorkspace()
  const { sessions } = useExpansion()
  const session = sessions[expansionId]

  const handleOpenExpandView = () => {
    openTab({
      id: `expand_view_${expansionId}_${card.id}`,
      type: 'expand_view',
      title: 'Expand View',
      nodeId: card.id,
      anchorNodeId: session?.nodeId,
      expansionId,
      closable: true,
      status: 'idle'
    })
  }

  return (
    <div className="ai-context-card">
      <span className="eyebrow">Algorithm Idea Inspector</span>
      <h3>{card.paperTitle}</h3>
      <span className="ai-context-badge">{card.evidenceSource.source}</span>
      <TruncatedText text={card.coreIdea} />
      <div className="ai-context-details">
        <div><strong>Key assumption</strong><TruncatedText text={card.keyAssumption} /></div>
        <div><strong>Mechanism</strong><TruncatedText text={card.mechanism} /></div>
        {card.strength && <div><strong>Strength</strong><TruncatedText text={card.strength} /></div>}
        {card.limitation && <div><strong>Limitation</strong><TruncatedText text={card.limitation} /></div>}
      </div>
      <div className="ai-context-actions">
        <button className="stage-btn stage-btn--primary" onClick={handleOpenExpandView}>进入 Expand View</button>
        <p>在中央 Workspace 中对比多个算法思想卡。</p>
      </div>
    </div>
  )
}

export default AlgorithmIdeaInspector
