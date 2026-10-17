# Prototype left pane: one draggable divider between Pages and Libraries

Owner: the left column (src/studio/prototype/left-pane.tsx, shell.tsx) stacks «Страницы | Структура» on top and «Библиотеки» below with several horizontal separator lines (above pages, between them, under the library, plus an extra strip at the bottom) — «нагромождение распределительных полос»; and he cannot make the Libraries section taller to see more elements, because Pages takes a fixed share.

Do:
1. Exactly one horizontal splitter between the Pages/Outline section and the Libraries section: a 6 px hit area with a 1 px line (border colour), cursor row-resize, hover/drag highlight in primary; drag to resize (min 80 px for each section); double-click the splitter toggles Pages between its last size and collapsed.
2. Each section header is a compact row (tabs on the left, a chevron to collapse the section on the right). Collapsing Pages gives all height to Libraries; collapsing Libraries gives it to Pages.
3. Remove the other decorative horizontal lines and the empty strip at the bottom of the column; keep only the header borders that separate a header from its content.
4. Default split: Pages 30 % / Libraries 70 %. Remember the split ratio and collapsed states in localStorage per plugin (key `office-studio.leftPane`), restore on open.
5. Keyboard: the splitter is focusable (role="separator", aria-valuenow), ↑/↓ move it by 16 px.
Pure helper for clamping/ratio in `src/studio/prototype/pane-split.ts` + `pane-split.test.ts`.

## Completion
- [x] Add the draggable Pages/Libraries divider and remove extra separators.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-left-split`).
