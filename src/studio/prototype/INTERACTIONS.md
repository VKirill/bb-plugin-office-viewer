# Prototype builder — mouse and keyboard model

Shared rules for the canvas, outline (layers), and pages list unless noted.

## Selection

| Input | Canvas element | Outline layer | Page row |
| --- | --- | --- | --- |
| Click | Select element; clears others | Select layer; clears others | Activate page |
| Shift/Cmd+click | Toggle in selection | Toggle in selection | — (single page active) |
| Cmd/Ctrl+click | Same as Shift | Same as Shift | — |
| Click empty / background | Clear selection | — | — |
| Cmd/Ctrl+A | Select all elements on page | — | — |

Grouped elements expand to the whole group when any member is selected.

## Primary actions

| Input | Canvas | Outline | Pages |
| --- | --- | --- | --- |
| Double-click | Inline edit when supported | Rename layer label | Rename page |
| Drag | Move selection (modifiers: Shift axis, Alt duplicate, Esc cancel) | Reorder z-index (drag layer) | Reorder pages |
| Right-click | Context menu (element or empty canvas) | Layer menu (order, group, lock, hide, rename, delete) | Page menu |
| Page tab right-click | Tab menu (rename, duplicate, close, delete) | — | — |

## Context menus

- Palette tile, template tile, and icon tile each open an insert menu.
- Native browser context menus are suppressed in Studio except inside text inputs.
- Menus support keyboard navigation (↑/↓, Home/End, Enter, Esc) and stay inside the viewport.

## Drawing tools

When a draw tool is armed (R/O/L/T/F): drag to size, click for default size, Esc to disarm. See canvas modifier hints for Shift, Alt, Space, and Cmd/Ctrl.

## Shortcuts (selection / edit)

Clipboard and z-order shortcuts match context menu labels (e.g. ⌘X cut, ⌘] bring forward). F2 renames the selected layer when the outline is available.
