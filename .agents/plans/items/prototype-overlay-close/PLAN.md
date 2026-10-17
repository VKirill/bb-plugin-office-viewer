# Prototype: tidy the side-pane overlay close button

Owner screenshot: in a narrow BB panel the left pane opens as an overlay, and its close «×» (src/studio/prototype/shell.tsx ≈ line 58, and the right one ≈ line 75) is a tiny shadowed text button absolutely positioned on top of the «Страницы | Структура» tabs — it overlaps the «Структура» tab and looks crooked.

Fix in shell.tsx (and the pane headers if needed):
1. Remove the absolutely positioned «×» buttons. Give each overlay a proper header row inside the pane: the existing tab strip on the left, and on the right a ghost icon button (size-7, rounded-md, `Icon name="Cancel01"` or the registry's close/X icon at size-4, muted foreground, hover bg-muted, aria-label/tooltip «Закрыть панель» / «Close panel»), vertically centred with the tabs; tabs get `min-w-0` and do not run under the button.
2. Add a translucent backdrop over the canvas (bg-black/10 dark:bg-black/30) while an overlay is open; clicking it or pressing Escape closes the overlay; focus returns to the rail button.
3. Overlay slides in (150 ms translate) and has a border on its inner edge; no outer shadow artefacts on the tab strip.
4. Same treatment for the right (inspector) overlay, close button on the right end of its tab row.
Wide layout (non-compact) is unchanged.

## Completion
- [x] Add proper close controls and backdrop behaviour to side-pane overlays.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-overlay-close`).
