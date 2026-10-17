# Prototype: interactions and preview player

Source: axure-re/index.md item 8 (Interactions tab: event → case → action tree, «Common interactions» presets) and item 20 (Preview player), data-model.md (events, actions names).

1. **Interactions tab** in the right pane («Взаимодействия», next to Стиль/Свойства/Заметки): «Новое взаимодействие» → event (Клик, Двойной клик, Наведение, Уход курсора, Изменение текста, Изменение выбора, Загрузка страницы) → one or more actions: Перейти на страницу, Открыть ссылку, Показать / Скрыть / Переключить видимость (target element, animation fade/slide), Установить состояние панели (panel, state, animation), Установить текст, Установить выбранным, Прокрутить к элементу, Подождать (ms). Cases with an optional simple condition (if text of X is empty/equals …). Common presets per type one click (Button: Клик → Перейти на страницу; Checkbox: Выбран → Показать). Stored as `element.interactions: [{event, cases: [{name, condition?, actions: [...]}]}]` (additive). Canvas shows a small lightning badge on elements with interactions.
2. **Preview** («.» key and a ▶ button in the toolbar): opens a player overlay in the Studio tab (or a new BB panel tab): renders the current page non-editable and runs interactions; top bar: close, pages dropdown with search, ←/→ pages, zoom (100 %, по ширине, вписать), «Показать горячие зоны», «Показать заметки». State is reset on page change.
3. «Отправить предпросмотр в чат»: attaches PNG of the current preview state.
4. The agent-readable JSON includes interactions in plain words (e.g. «Click → go to page "Checkout"») in the derived `tree`.
5. Pure engine `src/studio/prototype/interactions.ts` (event dispatch, action execution on a runtime state: visibility, panel states, texts, current page) + `interactions.test.ts` covering each action and conditions.

## Completion
- [x] Prototype: interactions and preview player.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-interactions-preview`).
