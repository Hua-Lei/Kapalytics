import { useState } from 'react'
import type { Stage } from '../../types'
import type { AnalysisStep, ExtractedPaperContent, GraphNode, KnowledgeGraph } from '../../../../shared/paper'
import { electronApi } from '../ipc/electronApi'
import {
  EMPTY_GRAPH,
  INITIAL_ANALYSIS_STEPS,
  markActiveStepFailed,
  sanitizeGraph,
  updateStep
} from './analysisState'

/** Convert structured ExtractedPaperContent to flat string for LLM prompt */
function formatExtractedForPrompt(content: ExtractedPaperContent): string {
  const pageTexts = content.pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n')
  if (content.formulaCandidates.length === 0) return pageTexts
  const lines = ['', '[Formula candidates extracted from PDF - reference hints, not final LaTeX]']
  for (const c of content.formulaCandidates.slice(0, 40)) {
    const loc = `Page ${c.page}${c.y !== undefined ? `, y=${Math.round(c.y)}` : ''}`
    lines.push(`${loc}: ${c.rawText}`)
    if (c.latexHint) lines.push(`LaTeX hint: ${c.latexHint}`)
  }
  return `${pageTexts}${lines.join('\n')}`
}

interface UsePaperAnalysisOptions {
  setStages: React.Dispatch<React.SetStateAction<Stage[]>>
  setActiveTab: (tab: 'graph' | 'learning') => void
  setSelectedGraphNodeId: (nodeId: string | null) => void
}

export function usePaperAnalysis({
  setStages,
  setActiveTab,
  setSelectedGraphNodeId
}: UsePaperAnalysisOptions) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [graph, setGraph] = useState<KnowledgeGraph>(EMPTY_GRAPH)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [genProgress, setGenProgress] = useState('')
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>(INITIAL_ANALYSIS_STEPS)

  const selectPdf = async () => {
    const selected = await electronApi.selectPdf()
    if (!selected) return

    setPdfUrl(selected.fileUrl)
    setGraph(EMPTY_GRAPH)
    setGenError('')
    setGenProgress('')
    setAnalysisSteps(INITIAL_ANALYSIS_STEPS)
    setSelectedGraphNodeId(null)
    setActiveTab('graph')
  }

  const analyzePaper = async () => {
    if (!pdfUrl) return
    setGenerating(true)
    setGenError('')
    setGraph(EMPTY_GRAPH)
    setSelectedGraphNodeId(null)
    setAnalysisSteps(updateStep(INITIAL_ANALYSIS_STEPS, 'extract', 'active'))
    setGenProgress('正在提取 PDF 文本...')

    try {
      const content = await electronApi.extractPdfText(pdfUrl)
      if (!content || !content.pages?.length) {
        setGenError('PDF 文本提取失败或内容过短，请确认 PDF 包含可读文本。')
        setAnalysisSteps((prev) => updateStep(prev, 'extract', 'error'))
        return
      }
      const totalChars = content.pages.reduce((sum, p) => sum + p.text.trim().length, 0)
      if (totalChars < 50) {
        setGenError('PDF 文本提取失败或内容过短，请确认 PDF 包含可读文本。')
        setAnalysisSteps((prev) => updateStep(prev, 'extract', 'error'))
        return
      }
      const promptText = formatExtractedForPrompt(content)
      setAnalysisSteps((prev) => updateStep(updateStep(prev, 'extract', 'done'), 'analyze', 'active'))
      setGenProgress(`提取完成（${totalChars} 字符${content.formulaCandidates.length ? `，${content.formulaCandidates.length} 个公式候选` : ''}），正在生成知识图谱和任务...`)

      const unsubscribe = electronApi.onLlmProgress(setGenProgress)
      try {
        const analysis = await electronApi.analyzePaper(promptText)
        const fullGraph = sanitizeGraph({
          nodes: analysis.graph.nodes.map((node) => ({ ...node, type: node.type as GraphNode['type'] })),
          edges: analysis.graph.edges
        })
        setStages((prev) => prev.map((stage) => ({ ...stage, task: analysis.tasks[stage.id] ?? stage.task })))
        setAnalysisSteps((prev) => updateStep(updateStep(prev, 'analyze', 'done'), 'reveal', 'active'))

        for (let i = 0; i < fullGraph.nodes.length; i += 1) {
          const nodes = fullGraph.nodes.slice(0, i + 1)
          const nodeIds = new Set(nodes.map((node) => node.id))
          setGraph({
            nodes,
            edges: fullGraph.edges.filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
          })
          setGenProgress(`正在呈现节点 ${i + 1}/${fullGraph.nodes.length}: ${fullGraph.nodes[i].label}`)
          await new Promise((resolve) => setTimeout(resolve, 180))
        }

        setAnalysisSteps((prev) => updateStep(prev, 'reveal', 'done'))
        setGenProgress('分析完成：知识图谱和学习任务已生成。')
        setActiveTab('graph')
      } finally {
        unsubscribe?.()
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : '分析失败')
      setAnalysisSteps(markActiveStepFailed)
    } finally {
      setGenerating(false)
    }
  }

  return {
    analysisSteps,
    analyzePaper,
    generating,
    genError,
    genProgress,
    graph,
    pdfUrl,
    selectPdf,
    setGraph,
    setPdfUrl
  }
}
