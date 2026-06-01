# Responsive Typography And Reading Layout Design

## Goal

Make font scaling apply consistently across the app and improve fullscreen reading layout for node expansion article views without making prose lines too long.

## Scope

- Replace the old local `style.zoom` font scaling with global CSS-variable scaling.
- Use larger default typography and remove the 85% setting.
- Make the top bar font-size control affect the central workspace, right context panel, sidebar, and expansion reading views.
- Keep expansion article prose readable on wide screens by constraining text measure while allowing supporting sections to use available width responsively.

## Design

Use `--app-font-scale` on `:root` and derive text tokens from it. The button cycles through `110%`, `120%`, `130%`, and `140%`, with `110%` as the default. This avoids Electron `zoom` side effects and reaches all components that use the shared tokens.

Expansion reading articles keep a readable max line length. On wider screens, the article container grows moderately, section padding increases, and secondary repeated content such as method families, hot directions, relation items, and paper chips can use responsive internal grids. Primary prose and formulas remain single-column.

## Non-Goals

- Do not redesign global navigation.
- Do not make long prose span the full fullscreen width.
- Do not add a separate font settings modal.
