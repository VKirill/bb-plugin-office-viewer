# Release 0.8.13

Stay in 0.8.x (installed range `^0.8.1`).
1. package.json and package-lock.json root version: 0.8.12 -> 0.8.13 (no reinstall).
2. CHANGELOG.md above 0.8.12, same style:

## 0.8.13 — 2026-10-17

### Added
- Prototype: draw shapes by dragging — R rectangle, O ellipse, L line, T text, F text field; a click still places the default size; Esc leaves the tool.
- Modifier keys as in Figma, Axure and Photoshop: ⇧ Shift keeps proportions (square, circle, 45° lines) when drawing and resizing and locks moves to an axis; ⌥ Alt draws and resizes from the centre and Alt-drag duplicates; Space moves the shape being drawn; ⌘/Ctrl turns snapping off; ⇧ rotates in 15° steps; Esc cancels a drag.
- A hint near the cursor names the active modifier, and «?» opens the keyboard shortcuts sheet.

Nothing else changes.

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `release-0.8.13`).

## Completion
- [x] Release 0.8.13.
