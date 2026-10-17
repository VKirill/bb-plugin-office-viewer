# Prototype: components (Axure masters)

1. «Создать компонент» (context menu, ⌥⇧⌘M) turns the selection into a component: stored in the document `components: [{id, name, elements, w, h}]` (additive field); the selection is replaced by an `Instance` element `{componentId, overrides: {[childId]: {text?, style?, hidden?}}}`.
2. Left pane gets a «Компоненты» tab next to Libraries: list with thumbnails, search, drag to canvas creates an instance; context menu: Переименовать, Редактировать, Дублировать, Удалить (asks if instances exist), Найти экземпляры.
3. Editing a component (double-click an instance → «Редактировать компонент» or from the list) opens it in place with a bar «Компонент: <name> ×»; changes update every instance live. Inside an instance, double-click text edits an override for that instance only (shown with a dot in the inspector; «Сбросить переопределения»).
4. «Отсоединить от компонента» turns an instance back into plain elements.
5. Components are per prototype file; export/Slides render instances; the agent-readable `tree` shows `Instance of <name>` with overrides.
6. Tests (`components.ts` + test): create from selection (relative coords, ids), instance render with overrides, detach, delete with instances.

## Completion
- [x] Prototype: components (Axure masters).

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-components`).
