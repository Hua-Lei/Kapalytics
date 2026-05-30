import MathText from './MathText'
import type { AlgorithmIdeaComparisonWorkspace } from '../../../shared/kg4'

function EmptyExpansionState({ message }: { message: string }) {
  return <div className="node-expansion-empty"><p>{message}</p></div>
}

interface ComparisonTableProps {
  workspace: AlgorithmIdeaComparisonWorkspace
}

function ComparisonTable({ workspace }: ComparisonTableProps) {
  if (workspace.insufficientInformation) return <EmptyExpansionState message={workspace.insufficientInformation} />
  return (
    <div className="kg4-comparison">
      <table className="node-detail__table sharp-comparison-table">
        <thead>
          <tr>
            <th>维度</th>
            <th>当前节点 / 论文</th>
            {workspace.selectedIdeaCardIds.map((id) => {
              const card = workspace.ideaCards.find((item) => item.id === id)
              return <th key={id}>{card?.paperTitle ?? id}</th>
            })}
            <th>Contrast Insight</th>
          </tr>
        </thead>
        <tbody>
          {workspace.comparisonRows.map((row) => (
            <tr key={row.dimension}>
              <td>{row.label}</td>
              <td><MathText text={row.currentNodeOrPaper} /></td>
              {row.selectedIdeas.map((cell) => <td key={cell.ideaCardId}><MathText text={cell.value} /></td>)}
              <td><MathText text={row.contrastInsight} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="kg4-reflection-questions">
        <span className="node-expansion__label">Reflection Questions</span>
        <ul>{workspace.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
      </div>
    </div>
  )
}

export default ComparisonTable
