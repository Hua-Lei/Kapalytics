import { createContext, useCallback, useState, type ReactNode } from 'react'
import { electronApi } from '../../modules/ipc/electronApi'
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../../../shared/electron-api'
import { generateLearningReport, type LearningReport } from '../../modules/learning/report'
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

  const resetStages = useCallback(() => {
    setStages([])
    setSelectedStageId(null)
    setAnswers({})
    setDrafts({})
    setDiagnosisResults({})
    setDiagnosedStageIds(new Set())
    setLearningReport(null)
    setDiagnosisError(null)
    setDiagnosisLoading(false)
    setPendingStageId(null)
  }, [])

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
    setLearningReport(generateLearningReport(stages, diagnosisResults, answers))
  }, [stages, diagnosisResults, answers])

  return (
    <StageContext.Provider value={{
      stages, selectedStageId, answers, drafts, diagnosisResults, diagnosedStageIds, learningReport,
      diagnosisError, diagnosisLoading,
      selectStage, enterStage, submitAnswer, confirmDiagnosis, retryStage, retryDiagnosis, markNeedsReview, updateDraft, generateReport, resetStages,
      setStages, setAnswers, setDiagnosisResults
    }}>
      {children}
    </StageContext.Provider>
  )
}
