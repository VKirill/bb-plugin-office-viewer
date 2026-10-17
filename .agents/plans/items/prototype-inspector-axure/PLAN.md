# Prototype: Axure inspector — Style tab, Properties, radio groups, list editor, table editing

Source: `.bb/chats/thr_wdpmipwdxc/artifacts/axure-re/index.md` section 4, 6 and «What to replicate» items 7, 8 (properties part only), 10, 17, 18, 19.

1. **Style tab** in Axure's exact order: align/distribute row → X, Y, rotation, W, lock aspect, H, corner radius, fit-to-content; flip H/V → Opacity → Typography (family from a short list of system fonts, weight, size, colour, line height, H-align, V-align) → Fill (colour) → Border (colour, width, sides, style) → Shadow (on/off, colour, x, y, blur) → Padding. Apply to any element; values stored in `element.style` (optional object in the model; renderer reads it over defaults). Multi-selection: title «Несколько элементов», mixed values blank, editing applies to all.
2. **Properties tab** per type (from index.md item 8 bottom): Text field: input type (text, password, email, number, date…), hint text, disabled; Radio: **«Группа радиокнопок»** combo (type a new name / pick existing / clear) — replaces the auto group from inline editing, same `props.group`; disabled, selected; Checkbox: disabled, selected; Droplist / List box: disabled, allow multiple (List box); **Style effects** list (Наведение, Нажатие, Выбрано, Отключено, Фокус) where each effect stores a partial style; the canvas shows an effect when you pick it in a «Просмотр состояния» dropdown.
3. **List editor dialog** for Droplist / List box / Menu / Tabs / Breadcrumbs: Add, «Редактировать списком» (textarea one item per line), Up/Down, Delete, checkbox column marking default selected item(s).
4. **Table editing** (Table and Repeater-table): click selects a cell, Enter/double-click edits it, Tab moves to next cell; right-click: insert row above/below, column left/right, delete row/column; drag column borders to resize; pasting a TSV block (from Excel/Sheets) fills cells from the selected one.
5. **Notes tab**: per-element note (existing) + a page note (Page overview) when nothing is selected; numbered note markers on the canvas toggle.
Tests: pure helpers for style merge (defaults + style + effect), radio group operations, list editor transforms, TSV paste into a table grid — `src/studio/prototype/inspector-model.ts` + test.

## Completion
- [x] Add the Axure-style Style and Properties inspector, list/table editing, and notes.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-inspector-axure`).
