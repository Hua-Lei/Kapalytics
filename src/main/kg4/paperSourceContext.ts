import type { ExtractedPaperContent } from '../../shared/paper'
import type { Kg4GraphNeighborhoodInput, PaperSourceContext } from '../../shared/kg4'
import type { GraphNode } from '../../shared/paper'

export interface MethodLineageContextInput {
  anchor: {
    nodeId: string
    label: string
    type?: string
    expansionType?: GraphNode['expansionType']
    description?: string
    classificationRationale?: string
  }
  paperSource: PaperSourceContext
  paperInsight?: {
    title?: string
    problem?: string
    method?: string
    contribution?: string
  }
  graphNeighborhood?: Kg4GraphNeighborhoodInput
}

export interface MethodLineageContext {
  anchor: MethodLineageContextInput['anchor']
  paperSource: PaperSourceContext
  paperInsight?: MethodLineageContextInput['paperInsight']
  localGraphNeighborhood: Kg4GraphNeighborhoodInput
  evidenceSlots: []
  readerIntent: 'novice_paper_anchored_lineage'
}

export function buildPaperSourceContext(pdfUrl: string, content: ExtractedPaperContent): PaperSourceContext {
  const pages = content.pages.map((page) => ({
    pageNumber: page.page,
    text: page.text
  }))
  return {
    pdfUrl,
    pages,
    extractedText: pages.map((page) => `[Page ${page.pageNumber}]\n${page.text}`).join('\n\n')
  }
}

export function buildMethodLineageContext(input: MethodLineageContextInput): MethodLineageContext {
  return {
    anchor: input.anchor,
    paperSource: input.paperSource,
    paperInsight: input.paperInsight,
    localGraphNeighborhood: input.graphNeighborhood ?? { nodes: [], edges: [] },
    evidenceSlots: [],
    readerIntent: 'novice_paper_anchored_lineage'
  }
}
