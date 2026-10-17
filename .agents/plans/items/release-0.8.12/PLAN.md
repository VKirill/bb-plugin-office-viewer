# Release 0.8.12

Stay in 0.8.x (installed range `^0.8.1`).
1. package.json and package-lock.json root version: 0.8.11 -> 0.8.12 (no reinstall).
2. CHANGELOG.md above 0.8.11, same style; check `git log --oneline v0.8.11..HEAD`:

## 0.8.12 — 2026-10-17

### Added
- Office Studio keeps your work: every change autosaves to the chat's files, and hiding the panel, switching chats or reloading BB brings back the same tool, document and view. A save status shows in the toolbar.

### Changed
- Prototype Style panel: standard alignment icons in one row with proper tooltips; controls no longer overlap; clear line height and font size fields.
- Colour picker: shows the real colour (or «Нет»), rainbow hue and transparency bars, HEX/RGB inputs, document colours, and opens without being cut off.

### Fixed
- Opacity and other Style fields now change the element on the canvas, in PNG export and in Slides.

Nothing else changes.

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `release-0.8.12`).

## Completion
- [x] Release 0.8.12.
