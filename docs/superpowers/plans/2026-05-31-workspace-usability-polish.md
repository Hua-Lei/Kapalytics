# Workspace Usability Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PDF Reader, stale graph state, Stage Learning empty behavior, and readability with a light workbench polish.

**Architecture:** Keep existing components and providers. Add isolated PDF scale helpers for testable fit/zoom behavior, reset paper/stage state through existing hooks, and update CSS tokens/layout styles in place.

**Tech Stack:** React 18, TypeScript, PDF.js, Electron Vite, CSS modules by global class files, Node test runner through existing TypeScript test setup.

---

## File Structure

- Modify `src/renderer/src/components/PdfViewer.tsx`: load PDF once per URL, compute page scale from container width and zoom, support wheel zoom, rerender on resize.
- Create `src/renderer/src/components/pdfScale.ts`: pure helpers for clamping zoom and computing fit scale.
- Create `src/renderer/src/components/pdfScale.test.ts`: unit tests for scale behavior.
- Modify `src/renderer/src/components/PdfReaderWorkspace.tsx`: render a light workbench header/action area and pass current PDF to viewer.
- Modify `src/renderer/src/domains/paper/usePaperAnalysis.ts`: keep clearing stale graph on PDF change and ensure saved graph applies only to selected PDF.
- Modify `src/renderer/src/domains/stages/StageProvider.tsx`: ensure stages can be reset when a new paper has no tasks.
- Modify `src/renderer/src/components/CentralWorkspaceRouter.tsx`: default Stage Learning to first available stage and improve empty state.
- Modify `src/renderer/src/styles/tokens.css`: update font stack and modest text tokens.
- Modify `src/renderer/src/styles/pdf.css`, `src/renderer/src/styles/panels.css`, `src/renderer/src/styles/learning.css`, `src/renderer/src/styles/layout.css`: light layout/spacing polish.

## Tasks

### Task 1: Add PDF Scale Helpers With Tests

- [ ] Create `src/renderer/src/components/pdfScale.test.ts` with tests for clamped zoom and width-fit scale.
- [ ] Run `npm test -- pdfScale` if available; if no test script exists, run `npm run typecheck` and note that dedicated test execution is unavailable.
- [ ] Create `src/renderer/src/components/pdfScale.ts` with `clampPdfZoom` and `getPdfRenderScale`.
- [ ] Verify typecheck passes.

### Task 2: Make PDF Viewer Responsive And Zoomable

- [ ] Modify `PdfViewer.tsx` to use the helper functions.
- [ ] Store loaded PDF document and original page widths.
- [ ] Add `ResizeObserver` on the viewer container.
- [ ] Add non-passive `wheel` handling for `ctrlKey`, preventing browser zoom and adjusting local zoom.
- [ ] Rerender canvases when PDF URL, container width, or zoom changes.
- [ ] Verify `npm run typecheck`.

### Task 3: Polish PDF Reader Workbench UI

- [ ] Modify `PdfReaderWorkspace.tsx` to add a title/description/action layout.
- [ ] Modify `panels.css` and `pdf.css` so the PDF workbench uses light surfaces, no dark rectangular toolbar, and the viewer fills remaining height.
- [ ] Verify `npm run typecheck`.

### Task 4: Clear Stale Graph And Stage State On PDF Change

- [ ] Inspect `StageProvider.tsx` reset API and add a minimal reset path if missing.
- [ ] Wire `selectPdf` to clear stage tasks when no saved analysis is restored.
- [ ] Ensure `查看知识图谱` shows only when `graph.nodes.length > 0` for the current selected paper.
- [ ] Verify `npm run typecheck`.

### Task 5: Improve Stage Learning Default And Empty State

- [ ] Modify `StageLearningWorkspace` to select the first stage when no stage is selected and stages exist.
- [ ] Replace the blank placeholder with a card that explains: analyze a PDF first, then select or start a stage.
- [ ] Adjust Stage Learning grid width and detail max width so content uses more space.
- [ ] Verify `npm run typecheck`.

### Task 6: Apply Typography And Spacing Polish

- [ ] Update `tokens.css` font stack and text tokens.
- [ ] Adjust button, sidebar, Stage Learning, and central workspace body spacing enough to reduce the “small text” feel without breaking layout.
- [ ] Verify `npm run typecheck`.

### Task 7: Final Verification

- [ ] Run `npm run typecheck`.
- [ ] If feasible, launch `npm run dev` and manually verify PDF loading, window resize, `Ctrl + wheel` zoom, PDF replacement, graph button state, and Stage Learning content.
- [ ] Report any manual verification limitations.
