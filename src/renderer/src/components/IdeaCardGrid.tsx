import MathText from './MathText'
import type { AlgorithmIdeaCard } from '../../../shared/kg4'

function EmptyExpansionState({ message }: { message: string }) {
  return <div className="node-expansion-empty"><p>{message}</p></div>
}

interface IdeaCardGridProps {
  cards: AlgorithmIdeaCard[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

function IdeaCardGrid({ cards, selectedIds, onToggle }: IdeaCardGridProps) {
  if (!cards.length) return <EmptyExpansionState message="当前没有可追溯的算法思想卡。请接入检索 provider 或扩充知识源。" />
  return (
    <div className="kg4-card-grid">
      {cards.map((card) => {
        const selected = selectedIds.includes(card.id)
        return (
          <button
            key={card.id}
            className={`kg4-idea-card ${selected ? 'kg4-idea-card--selected' : ''}`}
            onClick={() => onToggle(card.id)}
            type="button"
          >
            <span className="kg4-card-source">{card.evidenceSource.source} · {card.evidenceSource.externalId}</span>
            <strong>{card.paperTitle}</strong>
            <p><b>问题：</b><MathText text={card.problemSetting} /></p>
            <p><b>思想：</b><MathText text={card.coreIdea} /></p>
            <p><b>假设：</b><MathText text={card.keyAssumption} /></p>
            <p><b>机制：</b><MathText text={card.mechanism} /></p>
            <p><b>优势：</b><MathText text={card.strength} /></p>
            <p><b>局限：</b><MathText text={card.limitation} /></p>
          </button>
        )
      })}
    </div>
  )
}

export default IdeaCardGrid
