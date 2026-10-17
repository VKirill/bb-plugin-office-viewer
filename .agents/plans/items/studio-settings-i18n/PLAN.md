# Office Studio settings and full RU/EN translation

Owner: «у нас должны быть настройки Office Studio, и язык, который я выбрал, — на нём отображается весь интерфейс всех программ»; today some labels are raw English or mixed.

1. **Settings**: a gear icon button in the Office Studio launcher header and in each tool's toolbar (Prototype, Paint, Slides) opening a «Настройки Office Studio» popover/dialog:
   - Язык интерфейса: Как в BB (auto, current `detectLocale`) / Русский / English — applies immediately to the launcher and all tools without reload (make `t()` read a reactive locale: a tiny store with subscribe + a `useLocale()` hook; components re-render on change).
   - Прототип: размер экрана по умолчанию (preset), сетка (шаг 5/8/10 px, показывать/привязка), бейджи по умолчанию вкл/выкл, единицы px.
   - Рисование: цвет и толщина кисти по умолчанию.
   - Persist in plugin storage per user (SDK settings/kv if available in app code — check `useSettings`/PluginSettingDescriptors in the SDK types; otherwise localStorage key `office-studio.settings`). Also declare a plugin setting «Язык Office Studio» in the plugin's settings descriptors if the SDK supports it, kept in sync.
2. **Translation audit**: every user-visible string in `src/studio/**` (launcher, prototype: toolbar, palette, templates, icons, inspector, properties, notes, context menus, dialogs, tooltips, element default texts for new elements; paint; slides) goes through i18n with RU and EN. Add a test `src/studio/i18n-coverage.test.ts` that scans `src/studio/**/*.tsx` for JSX text nodes and string literals passed to `title`, `aria-label`, `placeholder`, `label` props that are not i18n calls (allow-list for symbols like «×», «%», numbers) and fails on hard-coded words; and that every key has both RU and EN values.
3. Element default texts (Button → «Кнопка» / «Button», etc.) follow the chosen language when creating new elements; existing elements keep their text.

## Completion
- [x] Add Office Studio settings and full Russian/English tool translations.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `studio-settings-i18n`).
