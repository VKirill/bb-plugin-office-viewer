# Prototype: dynamic panel states with content, repeater data, in-place container editing

Source: axure-re/index.md «What to replicate» item 15 and data-model.md (states, repeater data). Today DynamicPanel only has state names, Repeater only sample data props.

1. **Dynamic panel states with content**: each state holds its own child elements (model: `props.states: [{id, name}]`, children elements carry `parent: {id: panelId, state: stateId}`; additive optional fields, format version unchanged; parseWireframe migrates old string[] states). Double-click a panel → in-place editing: outside content dims, a floating bar «Состояние ▾ ‹ › Все состояния ×» switches states; drop/draw elements inside; children are clipped to the panel. Outline shows panel → states → children. Context menu: Добавить состояние, Дублировать состояние, Удалить, Переименовать. «Все состояния» shows thumbnails of states side by side.
2. **Repeater data**: in-place editing shows a data grid (columns, rows; add/remove row/column; paste TSV; «Импорт CSV») and a item template (elements inside the repeater's first item, bound to columns via `{{column}}` in text props). The canvas renders one item per data row (table or cards layout, gap, columns count). Inspector: layout, items per row, spacing, pagination (items per page).
3. **Group editing**: double-click a group enters it the same way (dim outside, breadcrumb bar «Страница › Группа ×»); Esc exits.
4. PNG export, Slides and the saved JSON include children; the agent-readable JSON nests children under their state/repeater in a derived `tree` field for readability (keep flat `elements` as source of truth).
5. Tests (`containers.ts` + test): state switching visibility, migration of string[] states, repeater rendering of rows with bindings, TSV/CSV parse, tree derivation.

## Completion
- [x] Prototype: dynamic panel states with content, repeater data, in-place container editing.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-containers`).
