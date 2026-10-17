# Prototype: Axure canvas behaviour and shortcuts

Source: `.bb/chats/thr_wdpmipwdxc/artifacts/axure-re/index.md` sections 2, 5, 6 and «What to replicate» items 11–14, 16 and the shortcuts table. Work in canvas.tsx / toolbar.tsx / builder.tsx as split by prototype-shell-pages.

1. **Selection**: marquee selection (drag on empty canvas; intersect mode by default, contain with ⌥), ⌘/Shift-click to add/remove; 8 round handles on a 1 px primary frame; Radio and Checkbox get only left/right handles; shapes (Box, Shape) get a corner-radius handle; group selection box.
2. **Group / Ungroup** (⌘G / ⇧⌘G): model `group` id on elements; clicking selects the group, double-click enters it (deep select with ⌥⌘-click). **Lock** (⇧⌘K) and **Hidden** toggles.
3. **Snapping and measuring**: snap to other elements' edges and centres with pink guide lines while dragging/resizing; grid 10 px (dots) with toggle ⌘' and snap toggle; ⌥-hover over another element shows pink distance lines with px labels; a «X, Y / W×H» tooltip while dragging/resizing.
4. **Nudging**: arrows 1 px, Shift+arrows 10 px; ⌘+arrows resize by 1, ⌘⇧+arrows by 10.
5. **Context menu** on an element (right click), in Axure's order: Вырезать/Копировать/Вставить, Вставить стиль (⌥⌘V), Дублировать, Удалить, Скрыть, Порядок ▸ (на передний ⇧⌘], вперёд ⌘], назад ⌘[, на задний ⇧⌘[), Группировать/Разгруппировать, Заблокировать, Выровнять ▸, Распределить ▸, Изменить текст, Заполнить Lorem Ipsum. On empty canvas: Вставить, Выделить всё, Сетка ▸.
6. **Tool shortcuts** (single key, only when not editing text): R прямоугольник, O эллипс, L линия, T текст, F поле ввода, D динамическая панель, H горячая зона, M стикер, «/» быстрая вставка — a command palette (search over palette entries, Enter inserts at the cursor/centre). Enter on a selected text element starts inline editing (as Axure); Esc exits.
7. **View**: ⌘+ / ⌘− / ⌘0, fit all ⌘1, zoom to selection ⌘2, Space-drag to pan, pinch/⌘-wheel zoom.
8. Toolbar tooltips show «Name (shortcut)» for all of these.
Tests: pure helpers for snapping (candidate guides, snapped position), marquee hit test (intersect/contain), group/ungroup transforms, nudge/resize — in `src/studio/prototype/canvas-math.ts` + `canvas-math.test.ts`.

## Completion
- [x] Add Axure-style canvas selection, groups, locking, guides, measurements, menus, shortcuts, and quick insert.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-canvas-axure`).
