# Prototype toolbar: icon toolbar like Axure/Figma

Owner: «меню тоже продумывай, оно у нас не UI-дружелюбное». Today the builder toolbar (src/studio/prototype/builder.tsx) is one long row of text buttons: Новый, Открыть, Сохранить, В чат, Бейджи | Компьютер Планшет Телефон | zoom − 100% + | Отменить Повторить Дублировать Удалить На передний план На задний план. Reference: Axure's top bar — compact icon buttons in groups with separators, tooltips, a zoom dropdown, a primary action button on the right.

New toolbar (one row, 40px high, `border-b`, wraps gracefully or collapses overflow into a «⋯» menu when the panel is narrow):
- Left: a «Файл» dropdown menu (icon + chevron) with Новый (Cmd+N-less, just item), Открыть… (submenu/list of saved prototypes), Сохранить (Cmd+S), Сохранить как…; the current prototype name shown next to it as editable text (click to rename).
- History group: icon buttons Undo, Redo.
- Edit group (enabled only with a selection): Duplicate, Delete, Bring forward, Send backward.
- Align group (enabled with ≥2 selected; align works with 1 relative to canvas): align left / center / right, top / middle / bottom, distribute horizontally / vertically. Add pure helpers in `src/studio/prototype/align.ts` with tests `align.test.ts`.
- Device: segmented control with icons (desktop, tablet, phone) + tooltip with the width.
- Zoom: a dropdown button showing «100%» with options 50/75/100/150/200%, «По размеру окна», plus Cmd+= / Cmd+- shortcuts.
- Badges: a toggle icon button (tag icon) with pressed state.
- Right: primary button «В чат» (send icon + text, the BB accent/primary style) with a small chevron dropdown: Скриншот и файл (default), Только скриншот, Только файл.
- Every icon button: 28px square, ghost style, `rounded-md`, hover bg-muted, active/pressed state, disabled at 40% opacity, a tooltip with the action name and its shortcut (e.g. «Отменить ⌘Z»). Use Hugeicons from the plugin's icon set (components/ui/icon.tsx / icon-registry.ts; register missing ones there) and the existing ui components (button, context-menu or dropdown from @radix-ui already in devDependencies).
- The «К инструментам» back row above stays but make it compact (16px icon + text, muted) and put it on the same row as the toolbar's left end if space allows.
Keep all actions and shortcuts working; RU/EN labels in src/shared/i18n.ts. Light and dark via theme tokens.

## Completion
- [x] Replace the text row with grouped icon controls, tooltips, align tools, zoom menu, and primary Send action.

### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-toolbar`).
