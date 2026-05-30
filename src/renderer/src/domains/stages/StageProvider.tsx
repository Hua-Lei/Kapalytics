import { createContext, useCallback, useState, type ReactNode } from 'react'
import { mockStages } from '../../mock/stages'
import { diagnose } from '../../modules/diagnosis/diagnose'
import { electronApi } from '../../modules/ipc/electronApi'
import { generateLearningReport } from '../../modules/learning/report'
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'
import type { StageContextValue } from './types'

export const StageContext = createContext<StageContextValue | null>(null)

export function StageProvider({ children }: { children: ReactNode }) {
  const [stages, setStages] = useState<Stage[]>(mockStages)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [diagnosisResults, setDiagnosisResults] = useState<Record<string, DiagnosisResult>>({})
  const [diagnosedStageIds, setDiagnosedStageIds] = useState<Set<string>>(new Set())
  const [learningReport, setLearningReport] = useState<LearningReport | null>(null)

  const selectStage = useCallback((id: string | null) => setSelectedStageId(id), [])

  const enterStage = useCallback((id: string) => {
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'in_progress' as const } : s))
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const submitAnswer = useCallback(async (id: string) => {
    const answer = drafts[id] ?? ''
    setAnswers((prev) => ({ ...prev, [id]: answer }))
    const stage = stages.find((s) => s.id === id)!
    let result: DiagnosisResult
    try {
      const hasKey = await electronApi.hasKey()
      result = hasKey
        ? await electronApi.diagnose({ stageId: id, stageName: stage.name, taskDescription: stage.task, userAnswer: answer })
        : diagnose(id, answer)
    } catch {
      result = diagnose(id, answer)
    }
    setDiagnosisResults((prev) => ({ ...prev, [id]: result }))
    if (!result.isCorrect) {
      setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'needs_review' as const } : s))
    }
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.add(id); return next })
  }, [drafts, stages])

  const confirmDiagnosis = useCallback((id: string) => {
    setStages((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: 'completed' as const, mastery: Math.min(100, s.mastery + 20) } : s
    ))
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const retryStage = useCallback((id: string) => {
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const markNeedsReview = useCallback((id: string) => {
    const answer = drafts[id] ?? ''
    setAnswers((prev) => ({ ...prev, [id]: answer }))
    const result = diagnose(id, answer)
    setDiagnosisResults((prev) => ({ ...prev, [id]: result }))
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
      selectStage, enterStage, submitAnswer, confirmDiagnosis, retryStage, markNeedsReview, updateDraft, generateReport,
      setStages, setAnswers, setDiagnosisResults
    }}>
      {children}
    </StageContext.Provider>
  )
}
