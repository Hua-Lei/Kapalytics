import type { PaperQualitySignal, PaperMethodDigest } from '../../shared/kg4'
import type { CompactLineagePaper } from './llmInput'
import type { MethodLineageContext } from './paperSourceContext'

export interface HybridMethodLineageSynthesisInput {
  requestNonce?: number
  methodLineageContext: MethodLineageContext
  retrievedPapers: CompactLineagePaper[]
  paperMethodDigests: PaperMethodDigest[]
  qualitySignals: PaperQualitySignal[]
  readerGoal: 'hybrid_pdf_and_retrieved_paper_lineage'
}

export function buildHybridMethodLineageSynthesisInput(params: {
  requestNonce?: number
  methodLineageContext: MethodLineageContext
  retrievedPapers: CompactLineagePaper[]
  paperMethodDigests: PaperMethodDigest[]
  qualitySignals: PaperQualitySignal[]
}): HybridMethodLineageSynthesisInput {
  return {
    requestNonce: params.requestNonce,
    methodLineageContext: params.methodLineageContext,
    retrievedPapers: params.retrievedPapers,
    paperMethodDigests: params.paperMethodDigests,
    qualitySignals: params.qualitySignals,
    readerGoal: 'hybrid_pdf_and_retrieved_paper_lineage'
  }
}
