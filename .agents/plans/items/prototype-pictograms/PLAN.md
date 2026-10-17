# Prototype palette: designed pictograms instead of live previews

Design is final: `.bb/chats/thr_wdpmipwdxc/artifacts/palette-pictograms/` — read `spec.md` (tile layout, states, theming rules, item → file → group → type mapping for all 98 items), `sheet.png` (target look) and `build/mapping.md`. 96 SVGs, 48×48.

1. Create `src/studio/prototype/pictograms.tsx` per spec.md: the SVGs as inline React components (or one map id → JSX generated from the SVG files; keep it tree-shakable and small), themed with `--picto-ink` (currentColor) and `--picto-accent` = BB theme primary (use the theme's primary token, not hard-coded #2563eb/#60a5fa); stickies keep `--picto-sticky-1…4` fixed paper colours; «Прямоугольник тёмный» (box-3) uses a fixed dark grey fill in both themes.
2. Palette tiles (wherever the palette lives after the shell split: left-pane.tsx or builder.tsx): replace the scaled live preview with `<Pictogram id>` from each palette entry's `pictogram` id; fallback by type as spec.md says. Tile per spec: 3 columns, ~90×98, 48 px pictogram, caption 11 px up to two lines without ellipsis; hover soft background, selected accent tint, focus ring; drag image = the pictogram.
3. Captions (i18n RU/EN) per the mapping: «Многострочное поле»; Axure naming — «Кнопка» = outline/secondary button, «Основная кнопка» = primary (filled), «Кнопка-ссылка»; «Подпись» for Label and «Текст»/«Абзац» as mapped; shortened «Гориз./Верт. линия», «Гориз./Верт. меню», «Стрелка гориз./верт.», «Стопка блоков». Map the palette entries' variant props so «Кнопка» creates the outline variant and «Основная кнопка» the primary one.
4. Group order and names: Основные, Динамические, Формы, Меню и таблицы, Содержимое, Разметка, Блок-схемы (collapsed by default).
5. Test (palette.test.ts): every palette entry has a pictogram id that exists in the pictogram map (or an explicit fallback).
Do not copy the build script into the repo; check the plugin bundle size before/after and report it.

## Completion
- [x] Replace live palette previews with designed pictograms for the palette tiles.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-pictograms`).
