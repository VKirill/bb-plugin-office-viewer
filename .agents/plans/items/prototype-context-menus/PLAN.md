# Prototype: one mouse model and context menus everywhere

Owner: right-click on a layer in Outline shows only the browser's native «Select All» — there must be our menu (bring to front, send to back, forward, backward…). «Продумай, где ПКМ, где ЛКМ». Today only canvas.tsx has onContextMenu (canvas-context-menu.tsx). Left pane (left-pane.tsx: Pages, Outline, Libraries), page tabs, inspector lists have none.

## Interaction model (document it in `src/studio/prototype/INTERACTIONS.md`, English, and follow it everywhere)
- LMB click: select (canvas, outline row, page). ⇧-click: range in lists / add on canvas; ⌘-click: toggle one.
- LMB double-click: canvas element → edit text (group → enter group); outline row → rename; page → rename; palette tile → insert at centre.
- LMB drag: canvas move; outline row → reorder z-order / drop into group; page → reorder; palette tile → drop on canvas.
- RMB: open our context menu for the thing under the cursor, selecting it first if it was not in the selection (keep multi-selection if it was). Native browser menu is suppressed inside Studio, except in text inputs while editing.
- Keyboard: menus list the shortcuts; Esc closes.

## Context menus (one shared component, reuse canvas-context-menu.tsx; submenus; disabled items greyed; shortcut hints)
1. **Canvas element / selection**: Вырезать ⌘X, Копировать ⌘C, Вставить ⌘V, Вставить стиль ⌥⌘V, Копировать стиль ⌥⌘C, Дублировать ⌘D, Удалить ⌫ | Порядок ▸ (На передний план ⇧⌘], Вперёд ⌘], Назад ⌘[, На задний план ⇧⌘[) | Сгруппировать ⌘G / Разгруппировать ⇧⌘G, Заблокировать ⇧⌘K, Скрыть ⇧⌘H | Выровнять ▸, Распределить ▸ | Изменить текст ⏎, Переименовать, Создать компонент (disabled until components exist), Превратить в динамическую панель | Отправить в чат как скриншот.
2. **Empty canvas**: Вставить, Выделить всё ⌘A, Сетка ▸ (показать, привязка, шаг), Направляющие ▸, Масштаб ▸, Фон страницы…
3. **Outline row**: same as element menu (order items act on the layer) + Показать/Скрыть, Заблокировать, Переименовать, Выделить на холсте, Перейти к элементу (zoom to selection ⌘2).
4. **Page (Pages tree and page tabs)**: Новая страница ⌘⏎, Новая дочерняя страница, Дублировать, Переименовать, Удалить, Вверх/Вниз, Закрыть вкладку / Закрыть другие (tabs).
5. **Palette tile**: Вставить в центр, Вставить в позицию курсора (last canvas point), О элементе (help tooltip text).
6. **Templates/Icons tiles**: Вставить, Копировать название иконки.
7. **Inspector list editors** (list items, table rows/cols): already have menus for tables — align style with the shared menu.
Menus render in a portal, flip to stay in the viewport, keyboard navigable (↑↓, →/← submenus, Enter), RU/EN.

## Tests
Pure helpers: z-order operations (front/forward/backward/back) on a list incl. groups and multi-selection preserving relative order; menu model builder returning enabled/disabled items for a given selection/target (`src/studio/prototype/menus.ts` + `menus.test.ts`).

## Completion
- [x] Prototype: one mouse model and context menus everywhere.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-context-menus`).
