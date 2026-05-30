import { createContext, useCallback, useState, type ReactNode } from 'react'
import { electronApi } from '../../modules/ipc/electronApi'
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'
import type { StageContextValue } from './types'

export const StageContext = createContext<StageContextValue | null>(null)

export function StageProvider({ children }: { children: ReactNode }) {
  const [stages, setStages] = useState<Stage[]>([])
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [diagnosisResults, setDiagnosisResults] = useState<Record<string, DiagnosisResult>>({})
  const [diagnosedStageIds, setDiagnosedStageIds] = useState<Set<string>>(new Set())
  const [learningReport, setLearningReport] = useState<LearningReport | null>(null)
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null)
  const [diagnosisLoading, setDiagnosisLoading] = useState(false)
  const [pendingStageId, setPendingStageId] = useState<string | null>(null)

  const selectStage = useCallback((id: string | null) => setSelectedStageId(id), [])

  const enterStage = useCallback((id: string) => {
    setDiagnosisError(null)
    setPendingStageId(null)
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'in_progress' as const } : s))
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const submitAnswer = useCallback(async (id: string) => {
    setDiagnosisError(null)
    setDiagnosisLoading(true)
    setPendingStageId(id)
    const answer = drafts[id] ?? ''
    setAnswers((prev) => ({ ...prev, [id]: answer }))
    const stage = stages.find((s) => s.id === id)
    if (!stage) {
      setDiagnosisError('Stage not found')
      setDiagnosisLoading(false)
      return
    }
    try {
      const result = await electronApi.diagnose({
        stageId: id,
        stageName: stage.name,
        taskDescription: stage.task,
        userAnswer: answer,
      })
      setDiagnosisResults((prev) => ({ ...prev, [id]: result }))
      setPendingStageId(null)
      if (!result.isCorrect) {
        setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'needs_review' as const } : s))
      }
      setDiagnosedStageIds((prev) => { const next = new Set(prev); next.add(id); return next })
    } catch (e) {
      setDiagnosisError(e instanceof Error ? e.message : 'Diagnosis failed')
    } finally {
      setDiagnosisLoading(false)
    }
  }, [drafts, stages])

  const confirmDiagnosis = useCallback((id: string) => {
    setDiagnosisError(null)
    setStages((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: 'completed' as const, mastery: Math.min(100, s.mastery + 20) } : s
    ))
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const retryStage = useCallback((id: string) => {
    setDiagnosisError(null)
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const retryDiagnosis = useCallback(() => {
    if (pendingStageId) {
      submitAnswer(pendingStageId)
    }
  }, [pendingStageId, submitAnswer])

  const markNeedsReview = useCallback((id: string) => {
    const answer = drafts[id] ?? ''
    setAnswers((prev) => ({ ...prev, [id]: answer }))
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'needs_review' as const } : s))
  }, [drafts])

  const updateDraft = useCallback((id: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }))
  }, [])

  const generateReport = useCallback(() => {
    const completed = stages.filter((s) => s.status === 'completed')
    const reviewStages = stages.filter((s) => s.status === 'needs_review')
    const wrongEntries = stages
      .map((s) => ({ stage: s, result: diagnosisResults[s.id] }))
      .filter((entry): entry is { stage: Stage; result: DiagnosisResult } => !!entry.result && !entry.result.isCorrect)

    const mastered = completed.length
      ? completed.map((s) => `Stage ${s.order}: ${s.name}`)
      : ['No completed stages yet.']

    const weakPoints = wrongEntries.length
      ? wrongEntries.map(({ stage, result }) => `Stage ${stage.order} ${stage.name}: ${result.errorType}`)
      : reviewStages.length
        ? reviewStages.map((s) => `Stage ${s.order} ${s.name}: Marked for review`)
        : ['No weak points identified yet.']

    const errorHistory = wrongEntries.map(({ stage, result }) => ({
      stageName: stage.name,
      errorType: result.errorType,
      feedback: result.feedback,
    }))

    const reviewRecommendations = [
      ...reviewStages.map((s) => `Review "${s.name}" - retry the stage task`),
      ...wrongEntries.slice(0, 3).map(({ stage, result }) => `For "${stage.name}": ${result.remedialTask}`),
    ]
    const uniqueRecommendations = [...new Set(reviewRecommendations)]
    if (uniqueRecommendations.length === 0) {
      uniqueRecommendations.push('Start working on a stage to get recommendations.')
    }

    const completionRate = stages.length ? Math.round((completed.length / stages.length) * 100) : 0

    setLearningReport({
      generatedAt: new Date().toISOString(),
      summary: `Completed ${completed.length}/${stages.length} stages (${completionRate}%). ${wrongEntries.length ? `${wrongEntries.length} diagnosis errors found.` : 'No errors diagnosed.'}`,
      mastered,
      weakPoints,
      errorHistory,
      reviewRecommendations: uniqueRecommendations,
      nextPaperRecommendation: 'Continue with the next paper in your reading list.',
    })
  }, [stages, diagnosisResults])

  return (
    <StageContext.Provider value={{
      stages, selectedStageId, answers, drafts, diagnosisResults, diagnosedStageIds, learningReport,
      diagnosisError, diagnosisLoading,
      selectStage, enterStage, submitAnswer, confirmDiagnosis, retryStage, retryDiagnosis, markNeedsReview, updateDraft, generateReport,
      setStages, setAnswers, setDiagnosisResults
    }}>
      {children}
    </StageContext.Provider>
  )
}
