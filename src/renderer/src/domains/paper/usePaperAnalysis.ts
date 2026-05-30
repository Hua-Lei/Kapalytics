import { useState } from 'react'
import type { AnalysisStep, GraphNode, KnowledgeGraph, PaperInsight } from '../../../../shared/paper'
import { electronApi } from '../../modules/ipc/electronApi'
import {
  EMPTY_GRAPH,
  INITIAL_ANALYSIS_STEPS,
  derivePaperInsight,
  markActiveStepFailed,
  sanitizeGraph,
  updateStep
} from '../../modules/paper/analysisState'

interface UsePaperAnalysisOptions {
  setStagesRef: React.MutableRefObject<((tasks: Record<string, string>) => void) | null>
  onAnalysisComplete: () => void
  setSelectedGraphNodeId: (nodeId: string | null) => void
}

function makeLocalPaperId(pdfUrl: string): string {
  let hash = 0
  for (let i = 0; i < pdfUrl.length; i += 1) {
    hash = (hash * 31 + pdfUrl.charCodeAt(i)) >>> 0
  }
  return `local_${hash.toString(16)}`
}

function inferTitleFromPdfUrl(pdfUrl: string): string {
  try {
    const pathname = decodeURIComponent(new URL(pdfUrl).pathname)
    return pathname.split('/').filter(Boolean).at(-1)?.replace(/\.pdf$/i, '') || 'Uploaded Paper'
  } catch {
    return 'Uploaded Paper'
  }
}

export function usePaperAnalysis({
  setStagesRef,
  onAnalysisComplete,
  setSelectedGraphNodeId
}: UsePaperAnalysisOptions) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [graph, setGraph] = useState<KnowledgeGraph>(EMPTY_GRAPH)
  const [paperInsight, setPaperInsight] = useState<PaperInsight | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [genProgress, setGenProgress] = useState('')
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>(INITIAL_ANALYSIS_STEPS)

  const selectPdf = async () => {
    const selected = await electronApi.selectPdf()
    if (!selected) return

    setPdfUrl(selected.fileUrl)
    setPdfPath(selected.filePath)
    setGraph(EMPTY_GRAPH)
    setPaperInsight(null)
    setGenError('')
    setGenProgress('')
    setAnalysisSteps(INITIAL_ANALYSIS_STEPS)
    setSelectedGraphNodeId(null)
    onAnalysisComplete()
  }

  const analyzePaper = async () => {
    if (!pdfUrl) return
    setGenerating(true)
    setGenError('')
    setGraph(EMPTY_GRAPH)
    setPaperInsight(null)
    setSelectedGraphNodeId(null)
    setAnalysisSteps(updateStep(INITIAL_ANALYSIS_STEPS, 'extract', 'active'))
    setGenProgress('正在提取 PDF 文本...')

    try {
      const content = await electronApi.extractPdfText(pdfUrl)
      // Check for IPC-level error
      const maybeError = content as unknown as { error?: string }
      if (maybeError?.error) {
        setGenError(`PDF 提取失败: ${maybeError.error}`)
        setAnalysisSteps((prev) => updateStep(prev, 'extract', 'error'))
        return
      }
      if (!content || !Array.isArray(content.pages) || content.pages.length === 0) {
        setGenError('PDF 文本提取失败：无法读取页面文本，请确认 PDF 包含可选中的文字。')
        setAnalysisSteps((prev) => updateStep(prev, 'extract', 'error'))
        return
      }
      const totalChars = content.pages.reduce((sum, p) => sum + p.text.trim().length, 0)
      if (totalChars < 20 && content.formulaCandidates.length === 0) {
        setGenError(`PDF 文本过短（共 ${totalChars} 字符），可能是扫描版 PDF，请使用包含文字层的 PDF。`)
        setAnalysisSteps((prev) => updateStep(prev, 'extract', 'error'))
        return
      }
      setAnalysisSteps((prev) => updateStep(updateStep(prev, 'extract', 'done'), 'analyze', 'active'))
      setGenProgress(`提取完成（${totalChars} 字符${content.formulaCandidates.length ? `，${content.formulaCandidates.length} 个公式候选` : ''}），正在生成知识图谱和任务...`)

      const unsubscribe = electronApi.onLlmProgress(setGenProgress)
      try {
        const analysis = await electronApi.analyzePaper(content)
        const fullGraph = sanitizeGraph({
          nodes: analysis.graph.nodes.map((node) => ({ ...node, type: node.type as GraphNode['type'] })),
          edges: analysis.graph.edges
        })
        setPaperInsight(analysis.insight ?? derivePaperInsight(fullGraph))
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
        setStagesRef.current?.(analysis.tasks)
        setGenProgress('分析完成：知识图谱和学习任务已生成。')
        const paperId = makeLocalPaperId(pdfUrl)
        electronApi.kg3.saveCurrentGraph({
          paperId,
          title: inferTitleFromPdfUrl(pdfUrl),
          fileUrl: pdfUrl,
          filePath: pdfPath ?? undefined,
          data: { graph: fullGraph, paperInsight: analysis.insight ?? derivePaperInsight(fullGraph) }
        }).then(() => electronApi.kg3.fusePaperGraph(paperId)).catch((err) => {
          console.warn('[KG3] Failed to save long-term memory:', err)
          setGenProgress('分析完成，但长期记忆保存失败。你仍可继续学习。')
        })
        onAnalysisComplete()
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
    paperInsight,
    pdfUrl,
    selectPdf,
    setGraph,
    setPaperInsight,
    setPdfUrl
  }
}
