# Release 0.8.11

The installed source range is `^0.8.1` — stay in 0.8.x.
1. package.json and package-lock.json root version: 0.8.10 -> 0.8.11 (no reinstall).
2. CHANGELOG.md above 0.8.10, same style; read `git log --oneline v0.8.10..HEAD` to be accurate:

## 0.8.11 — 2026-10-17

### Added
- Office Studio **Slides**: a deck editor on the prototype engine with slide thumbnails, layout presets, a presenter mode, PNG and PowerPoint export and sending to the chat.
- Prototype **Templates**: ready forms (sign-in, registration, checkout, card payment, feedback, search with filters, profile…) and interface blocks (header, sidebar, footer, product cards, pricing, table with pagination, dialogs…).
- **Office Studio settings**: interface language (as in BB, Russian, English) for every tool, default screen size, grid, badges and brush.

### Changed
- Prototype Style panel: icon alignment row, geometry grid, collapsible sections, font and weight pickers, text alignment icons and a colour picker instead of typed colours.
- One «Screen size» control with device presets and orientation instead of duplicated device buttons.
- One draggable divider between Pages and Libraries; side panels in a narrow window close with a proper button, a click outside or Esc.

### Fixed
- Icons in the prototype Icons library and on the canvas are displayed again.

Nothing else changes.

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `release-0.8.11`).
