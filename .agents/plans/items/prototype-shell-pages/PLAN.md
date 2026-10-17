# Prototype: Axure-style shell — pages, outline, three columns, style bar

Source of truth: `.bb/chats/thr_wdpmipwdxc/artifacts/axure-re/index.md` — read sections 1, 2, 3 and «What to replicate» items 1–4, 9; screenshots referenced there are in the same folder. Copy layout and behaviour, not Axure assets.

builder.tsx is 1 274 lines; first split it so later tasks can work on parts: `shell.tsx` (layout), `left-pane.tsx` (pages/outline + libraries), `inspector.tsx` (right pane), `canvas.tsx` (board, selection, drag), `toolbar.tsx`, keeping `builder.tsx` as the state owner (document, history, selection). Pure move first, then features.

1. **Multiple pages**: wireframe format v2: `{format:"bb-wireframe", version:2, name, pages:[{id,name,canvas,elements,notes?}], activePage}`; `parseWireframe` migrates v1 files to one page transparently; saving writes v2. Tests for the migration.
2. **Three-column shell** like Axure: left column ≈260 px resizable with two stacked resizable groups — top tabs «Страницы | Структура» (Pages | Outline), bottom «Библиотеки» (the current palette, incl. Elements/Icons switch); centre canvas; right column ≈260 px with tabs «Стиль | Свойства | Заметки» (Style | Properties | Notes; the current inspector content goes to Style/Properties, the element note to Notes). Panes toggle with ⌥⌘[ and ⌥⌘]. On a narrow BB panel (<900 px) the side columns collapse to icon rails that open as overlays.
3. **Pages pane**: tree of pages: add (⌘Enter), rename (double-click), duplicate (⌘D in the tree), delete, drag to reorder; selecting switches the canvas. **Outline pane**: list of elements of the current page in z-order with type icon + label; click selects, double-click renames, eye toggle hidden, lock toggle; drag to reorder z-order.
4. **Canvas tab strip** for open pages above the canvas; **rulers** (top/left, px, highlight band showing the selection extent).
5. **Context style bar** under the toolbar: no selection → page settings (device preset, W/H, background); a selection → X, Y, W, H, fill, border, radius, font size, text colour for the selection.
6. Save/send keep working; PNG/screenshot exports the active page; «В чат» attaches the active page PNG and the whole JSON.
Keep light/dark via theme tokens, RU/EN strings.

## Completion
- [x] Add the Axure-style three-column shell, pages and outline, rulers, and style bar.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-shell-pages`).
