# Workspace Usability Polish Design

## Goal

Fix the current PDF Reader and Stage Learning usability issues while applying a light layout, spacing, and typography polish across the central workspace.

## Scope

- PDF Reader action controls should no longer sit inside a dark PDF canvas strip.
- PDF rendering should fill available width and support user zoom through `Ctrl + wheel` and trackpad zoom-like wheel input.
- Changing PDF should clear stale paper graph, paper insight, analysis steps, and learning stages until the newly selected paper has its own saved or generated analysis.
- Stage Learning should show useful content immediately by defaulting to the first stage when stages exist, with a better empty state when no stages exist.
- Global text should become more readable through a CJK-friendly system font stack and modest size/spacing increases.

## Approach

Use a focused “workbench polish” approach rather than a redesign. Keep existing React components and domain providers, but tighten state reset behavior, add PDF viewer zoom/responsive rendering, and adjust CSS tokens and workspace styles.

## Component Changes

- `PdfReaderWorkspace.tsx` keeps the current action set but renders it as a normal light workbench toolbar above the viewer.
- `PdfViewer.tsx` owns PDF loading, width fitting, zoom state, resize observation, and rerendering pages at the computed scale.
- `usePaperAnalysis.ts` clears current analysis immediately on new PDF selection and exposes a paper-change signal through existing state changes.
- `StageLearningWorkspace` in `CentralWorkspaceRouter.tsx` selects the first stage when no stage is selected and stages exist.
- CSS files update the PDF workbench, Stage Learning layout, and font tokens without changing navigation semantics.

## Typography

Use a dependency-free system stack optimized for mixed English and Chinese reading:

```css
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif
```

This improves the app on macOS, Windows, and Linux without introducing a bundled font or network request.

## Testing

- Add focused unit coverage where logic can be isolated, especially PDF scale calculation and graph reset expectations if practical in existing test setup.
- Run `npm run typecheck` as the final verification.
- Manually verify PDF load, resize, `Ctrl + wheel` zoom, PDF replacement state, and Stage Learning default selection in the Electron UI.
