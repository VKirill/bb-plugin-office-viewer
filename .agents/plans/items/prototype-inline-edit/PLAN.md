# Prototype: inline text editing on double click, Enter adds the next item

Owner tried: double-click a Radio on the canvas to rename it, then press Enter to get another radio below in the same block. Nothing happens today: the builder (src/studio/prototype/builder.tsx) has no inline editing; text is only editable in the inspector.

Do:
1. Double-click an element on the canvas → inline edit of its main text in place (a contentEditable span or an absolutely positioned input over the text, same font/size, auto-selected text). Main text per type: Button/Checkbox/Radio/Switch/Badge/Text/Heading → `text` (or whatever key elements.tsx reads); TextField/TextArea → placeholder; Header/Card/Modal → title; Image → alt/label. Enter (without Shift) commits, Escape cancels, blur commits. Commit is one undo step. While editing, keyboard shortcuts of the canvas (Delete, arrows, Cmd+D, Cmd+Z) do not fire.
2. Elements with item lists (List, Nav, Tabs → `items`; ChoicePicker → `options`; Table → header cells if simple): double-click edits the clicked item; Enter commits it and inserts a new empty item right after it in the same element, already in edit mode; Backspace on an empty item removes it and moves to the previous one; the element grows in height (List) to fit the new item.
3. Checkbox and Radio: Enter commits and creates a new element of the same type directly below (x same, y = y + h + 8 snapped, same w/h), with text «Radio 2» / «Checkbox 2» style auto-numbering, selected and in edit mode — so typing then Enter keeps building the group. Give the new element and the source element the same `props.group` value (the first element's id when the source has none) so the saved file says they belong together; the inspector shows the group as read-only text. Radios in one group: checking one unchecks the others.
4. Inspector stays in sync with inline edits.
5. Tests (node:test, .ts only): extract the pure helpers (main text key per type, insert item after index, next-in-group element creation with numbering and group id, radio group exclusivity) to `src/studio/prototype/editing.ts` and test them in `src/studio/prototype/editing.test.ts`.

## Completion
- [x] Add inline editing and Enter-driven list and radio/checkbox creation.

### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-inline-edit`).
