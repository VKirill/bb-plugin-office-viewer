# Release 0.8.14

Stay in 0.8.x (installed range `^0.8.1`).
1. package.json and package-lock.json root version: 0.8.13 -> 0.8.14 (no reinstall).
2. CHANGELOG.md above 0.8.13, same style; check `git log --oneline v0.8.13..HEAD`:

## 0.8.14 — 2026-10-18

### Added
- Prototype: right-click menus everywhere — layers (order: to front, forward, backward, to back; group, lock, hide, rename, delete), canvas, pages and tabs, library tiles; one consistent click, double-click and drag behaviour.
- Connectors between flowchart shapes (E): anchors, straight, elbow and curved routes, arrowheads, dashed lines and labels; they follow the shapes.
- Dynamic panels with their own content per state and in-place editing; repeaters render rows from an editable data grid (paste from Excel, CSV import); double-click enters groups.
- Components: make a reusable component from a selection, a Components tab, instances that update together, per-instance text overrides, detach.
- Interactions (event → case → action: go to page, open link, show/hide, set panel state, set text…) and a Preview player («.» or ▶) with pages, zoom, hotspots and notes; send a preview screenshot to the chat.

Nothing else changes.

## Completion
- [x] Release 0.8.14.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `release-0.8.14`).
