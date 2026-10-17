# Changelog

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

## 0.8.10 — 2026-10-17

### Added

- Prototype: Axure-style workspace — pages and outline on the left over the libraries, Style / Properties / Notes on the right, rulers, page tabs and a context style bar; a prototype can have several pages (older files open and are upgraded).
- Prototype: the full standard widget set — Common, Dynamic (dynamic panel, repeater, hot spot, inline frame, snapshot), Forms, Menus and table, Content, Markup (arrows, stickies, markers) and 35 flowchart shapes.
- Prototype: an Icons library with search over thousands of free icons.
- Prototype canvas: marquee selection, groups, lock and hide, snap guides and distance lines, 10 px grid, context menu, single-key tools and «/» quick insert, zoom and pan shortcuts.
- Prototype inspector: full Style tab, per-type properties, radio groups, style effects (hover, pressed, selected, disabled, focus), list editor, table cell editing with TSV paste, page notes.

### Changed

- Prototype palette: clear designed pictograms in borderless tiles; elements on the canvas light up on hover and show a clear selection.

## 0.8.9 — 2026-10-17

### Changed

- Prototype palette: a grid of tiles with a live preview of each element and its name, grouped and collapsible, with variants (primary and link buttons, headings 1–3, image placeholder).
- Prototype toolbar: compact icon buttons with tooltips and shortcuts, a File menu, align and distribute, a device switch, a zoom menu with fit, and a primary «В чат» button with a choice of screenshot, file or both.

### Added

- Prototype: double-click edits text right on the canvas; Enter on a radio or checkbox adds the next one below (radios form a group), and Enter in lists, menus, tabs and dropdowns adds the next item.

## 0.8.8 — 2026-10-17

### Added

- **Office Studio**: an icon in the thread header (and an entry in the panel + menu) opens a tools tab with its own logos.
- **Prototype**: an Axure-like builder. Drag ready UI elements (header, navigation, buttons, fields, selects, checkboxes, cards, tables, tabs, modals and more) onto a canvas sized for desktop, tablet or phone; each element carries a name badge; edit labels, properties and notes in the inspector; undo and redo. Prototypes are saved in the chat's files (`Prototypes/*.wireframe.json` with a PNG) and go to the chat as a screenshot, a file the agent can read, or both.
- **Paint**: drawing with a smooth brush on a blank canvas, with colours, widths and an eraser; saved in the chat's files (`Paint/`) and sent to the chat as a picture.

## 0.8.7 — 2026-10-17

### Changed

- Spreadsheets: a cell with a link is sky-blue underlined text again, as before 0.8.6. Cmd/Ctrl+click still opens it.

## 0.8.6 — 2026-10-17

### Changed

- Spreadsheets: a cell with a link shows a chip like BB's chat links: the site's icon (GitHub, Figma, Notion, Slack, Telegram, YouTube, Google Docs and Drive; a globe for other sites) and the address without `https://`. A hyperlink with its own name keeps the name. Cmd/Ctrl+click opens it as before.

## 0.8.5 — 2026-10-17

### Added

- Website on devices: a **Browser** button before the address goes back to the page in BB's Browser.

## 0.8.4 — 2026-10-17

### Fixed

- A Website on devices tab opened from the panel's + menu reopens with the last address typed, instead of an empty address bar after a reload.

## 0.8.3 — 2026-10-17

### Fixed

- Screenshots of websites: the screenshot library loads from BB, not from the site the page's `<base>` points at.

## 0.8.2 — 2026-10-16

### Added

- Website on devices: a panel tab with an address bar that shows any web page in the same mockups as HTML files — compare, rotation, ruler and screenshots included. The plugin server fetches the page and its files, so sites that refuse to be framed still show; loopback, private and link-local addresses are refused.
- A button beside BB's Browser address bar (BB 0.46+) opens the current page there.

## 0.8.1 — 2026-10-16

### Fixed

- HTML screenshots no longer wait for unloaded images below the visible viewport, avoiding timeouts on long pages with lazy-loaded media.
- Capture only visible content, preload visible images and fonts, and reuse assets across compared devices.
- Resize large images and attach a smaller WebP composite, up to about 1600 pixels wide, for faster capture and chat attachment.
- Preserve sandboxed page styles and loaded web fonts in screenshots; verify that the embedded capture script parses correctly.

## 0.8.0 — 2026-10-16

### Added

- HTML layout viewer for `.html` and `.htm`: the page laid out at real device sizes inside realistic mockups. Phones show a notch, Dynamic Island or camera hole, a status bar and a home indicator. The iPad has a home button. Laptops and monitors have a browser window, the macOS menu bar or the Windows taskbar. The page gets only the viewport left by these bars.
- Screens from StatCounter (Russia, September 2026) with their shares. Five main ones are marked ★: 360×800, 414×896, 768×1024, 1366×768 and 1920×1080.
- Compare mode puts several devices side by side and picks the rows that show them largest in the panel. **★ Main screens only** selects the main set.
- Rotating phones and tablets; a custom size with drag handles; a breakpoint ruler; scale to fit or 25–100 %; reload; opening in a new tab; full screen; BB's own preview with the source.
- Screenshot of the devices into the chat as one PNG. Each sandboxed page draws itself after its scripts have run, with modern-screenshot. It works in any browser and in the BB app, without a screen-sharing prompt.
