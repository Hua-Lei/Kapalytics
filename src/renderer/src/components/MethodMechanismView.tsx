import { usePaper } from '../domains/paper/usePaper'
import MathText from './MathText'

function MethodMechanismView() {
  const { graph } = usePaper()
  const methodNodes = graph.nodes.filter((node) => ['method', 'formula', 'experiment'].includes(node.type))
  return (
    <div className="workspace-placeholder-view">
      <span className="eyebrow">Method Mechanism</span>
      <h3>方法机制拆解</h3>
      {methodNodes.length ? (
        <div className="workspace-node-list">
          {methodNodes.map((node) => (
            <article key={node.id}>
              <strong>{node.label}</strong>
              <p><MathText text={node.detail?.summary || node.description} /></p>
            </article>
          ))}
        </div>
      ) : <p>分析论文后，这里会聚合 method / formula / experiment 节点。</p>}
    </div>
  )
}

export default MethodMechanismView
