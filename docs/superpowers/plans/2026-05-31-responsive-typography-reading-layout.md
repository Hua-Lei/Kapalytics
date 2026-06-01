# Responsive Typography And Reading Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply font scaling globally and make expansion reading views adapt better to wide windows without harming readability.

**Architecture:** Replace DOM query `style.zoom` with a root CSS custom property. Update token definitions to use `--app-font-scale`, then adjust expansion reading CSS to use readable max widths and responsive sub-layouts.

**Tech Stack:** React 18, TypeScript, CSS custom properties, existing `npm run typecheck` verification.

---

## File Structure

- Modify `src/renderer/src/App.tsx`: change font scale defaults/cycle and set `--app-font-scale` on `document.documentElement`.
- Modify `src/renderer/src/styles/tokens.css`: derive text tokens from `--app-font-scale` and slightly increase base sizes.
- Modify `src/renderer/src/styles/layout.css`: ensure shell uses the scaled font and AppShell sidebar width matches CSS intent.
- Modify `src/renderer/src/components/AppShell.tsx`: stop overriding sidebar width with stale `190px`.
- Modify `src/renderer/src/styles/panels.css`: improve expansion reading article width and responsive internal grids.

## Tasks

### Task 1: Global Font Scaling

- [ ] Modify `App.tsx` default `fontScale` from `1` to `1.1`.
- [ ] Change font scale cycle to `[1.1, 1.2, 1.3, 1.4]`.
- [ ] Replace the `.panel-center .panel-body` `style.zoom` effect with `document.documentElement.style.setProperty('--app-font-scale', String(fontScale))`.
- [ ] Run `npm run typecheck`.

### Task 2: Scaled Tokens

- [ ] Add `--app-font-scale: 1.1` to `tokens.css`.
- [ ] Change `--text-xs`, `--text-sm`, `--text-md`, `--text-lg`, and `--text-xl` to use `calc(base * var(--app-font-scale))`.
- [ ] Increase eyebrow/topbar/sidebar text where hardcoded values currently bypass tokens.
- [ ] Run `npm run typecheck`.

### Task 3: Responsive Expansion Reading Layout

- [ ] Change `.concept-learning-view__article` and `.research-area-view__article` from fixed `max-width: 920px` to `width: min(100%, 1080px)`.
- [ ] Center article containers with `margin-inline: auto`.
- [ ] Add responsive internal grids for `.ra-section__stack` and relation/paper lists using `repeat(auto-fit, minmax(...))` only for secondary content.
- [ ] Keep main section paragraphs single-column with comfortable line-height.
- [ ] Run `npm run typecheck`.

### Task 4: Final Verification

- [ ] Run `npm run typecheck`.
- [ ] Report that final visual verification requires opening the Electron UI and testing the font button at each scale.
