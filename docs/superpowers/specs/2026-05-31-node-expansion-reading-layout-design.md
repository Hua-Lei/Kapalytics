# Node Expansion Reading Layout Design

## Goal

Make node expansion outputs easier to read by changing research-area and concept-teaching views from dashboard cards into article-like vertical notes, and improve KaTeX rendering for common LLM formula formats.

## Scope

- `ResearchAreaView` becomes a structured research note: overview, key problems, method families, hot directions, and recommended reading in one vertical reading flow.
- `ConceptLearningView` becomes a concept lecture note: quick intuition, formal definition, formulas, misconceptions, related concepts, and paper leads in one vertical flow.
- Color remains as subtle section accents rather than separate card blocks.
- `MathText` recognizes more math delimiters and display-mode bare formula bodies.
- KG4 concept prompt instructions are tightened so future formula outputs are easier to render.

## Non-Goals

- Do not redesign Expansion Graph canvas or temporary node graph behavior.
- Do not add a markdown parser dependency.
- Do not attempt arbitrary natural-language formula detection inside long paragraphs; only safe delimiters and explicit formula fields are normalized.

## Design

The rendering components keep their current props and data contracts. Layout changes happen inside `ResearchAreaView.tsx`, `ConceptLearningView.tsx`, and `panels.css`. Formula handling is isolated in a pure helper used by `MathText.tsx`, making it testable without React rendering.

`MathText` will support `$...$`, `$$...$$`, `\(...\)`, and `\[...\]`. When `displayMode` is true and the whole input looks like a formula body, it renders as one display formula even if the string lacks delimiters. This covers `formula.latex` fields such as `h = Wx + BAx` and `\Delta W = BA` while avoiding aggressive inline detection in prose.
