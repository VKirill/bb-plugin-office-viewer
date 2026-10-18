# Release 0.8.15

Stay in 0.8.x (installed range `^0.8.1`).
1. package.json and package-lock.json root version: 0.8.14 -> 0.8.15 (no reinstall).
2. CHANGELOG.md above 0.8.14, same style; check `git log --oneline v0.8.14..HEAD` for accuracy:

## 0.8.15 — 2026-10-18

### Added
- Agent loop: a wireframe schema for agents next to the chat's prototypes; the open builder picks up the agent's edits live (undoable); «Сгенерировать» asks the agent for a screen from a description or a screenshot (shown as a tracing layer).
- Pinned comments on the canvas; Spec export (Markdown with annotated screenshots, element tree, interactions, notes) and React + Tailwind code export; «В чат: сверстай это».
- Auto layout stacks (direction, gap, padding, alignment, hug/fill), constraints and per-device page views.
- Text and colour styles with import from DESIGN.md; Sketch / Mockup fidelity switch; ⌘K command palette; layers search; minimap; history panel; first-run tour.
- Publish a preview link served by BB; PDF, SVG and PNG exports; Excalidraw and SVG import.
- Version history with restore; faster canvas on large prototypes.

Nothing else changes.

## Completion
- [x] Ship the roadmap batch as 0.8.15.

## History
### 2026-10-18
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `release-0.8.15`).
