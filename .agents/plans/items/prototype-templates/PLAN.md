# Prototype: Templates library — ready UI patterns and forms

Owner: «стандартизированные формы сразу заложить». Axure ships «Sample UI patterns» (15) and «Sample form patterns» (48) — see `.bb/chats/thr_wdpmipwdxc/artifacts/axure-re/libraries.md` sections 4 and 5 for their names, structure and sizes (facts only; build ours from our own elements).

1. Palette switch becomes «Элементы | Шаблоны | Иконки» (Elements | Templates | Icons).
2. `src/studio/prototype/templates.ts`: a catalog of templates, each = name (RU/EN), group, pictogram/thumbnail rendering, and a function returning a list of our elements (relative coordinates) that is inserted as one **group** (uses the group model from prototype-canvas-axure) at the drop point / centre, selected after insert. All texts in Russian by default (owner's language), editable as usual.
3. Templates (at least these, sized for desktop; forms ~360–420 px wide):
   - Формы: Вход (email, пароль, «Запомнить меня», «Забыли пароль?», кнопка «Войти», ссылка «Регистрация»), Регистрация (имя, email, пароль, повтор, согласие, кнопка), Восстановление пароля, Обратная связь (имя, email, тема-выпадающий список, сообщение, кнопка), Оформление заказа (контакты, адрес, доставка-радио, оплата-радио, итог, кнопка), Оплата картой (номер, срок, CVC, имя, кнопка), Подписка на рассылку, Поиск с фильтрами (поле поиска, 3 выпадающих фильтра, кнопка), Профиль/настройки (аватар, поля, переключатели уведомлений, сохранить/отмена), Опрос (вопросы с радио и чекбоксами), Бронирование (дата, время, гости, кнопка), Загрузка файла с описанием.
   - Интерфейс: Шапка сайта (логотип, меню, кнопка), Боковое меню, Подвал, Хлебные крошки + заголовок страницы, Карточки товаров (3 в ряд), Тарифы (3 колонки), Таблица с поиском и пагинацией, Модальное окно подтверждения, Пустое состояние, Уведомления (alert'ы 4 типов), Вкладки с содержимым, Дашборд-плитки (4 метрики), Чат/комментарии, Список с аватарами.
4. Tiles: a small schematic thumbnail of the template (render the template's elements scaled into a 72×56 box with simplified faces — not tiny text; if a template looks noisy, draw just its block layout), caption under it, same calm tile style.
5. Search covers templates; drag and click insert work like elements.
6. Tests: every template builds elements that pass parseWireframe and fit their declared bounding box; no overlapping identical ids.

## Completion
- [x] Add a Templates library with ready forms and UI patterns.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-templates`).
