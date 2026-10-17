# Prototype: Icons library (Axure-style icon set)

Owner: «иконок не хватает, добавь какой-то пакет иконок». Axure ships an Icons library (Font Awesome grid: icon + name, search). We already depend on `@hugeicons/core-free-icons` (MIT, ~4 000 free icons, one ESM module per icon in dist/esm) — use it, no new package.

1. Palette gets a second view: a segmented switch at the top of the palette «Элементы | Иконки» (EN Elements | Icons).
2. Icons view: search field + virtualized grid (only visible rows rendered; simple windowing by scroll offset, no new dependency) of all free Hugeicons: icon (20px) + name under it (10px, muted, 2 lines), same calm tile style as the element palette (no borders, hover highlight). Show a few category chips if the package exposes tags; otherwise just search by name (split CamelCase, strip «Icon» suffix, e.g. `ArrowRight01Icon` → «arrow right 01»).
3. Loading: the full icon set must NOT go into the main bundle. Build the name list at build time or load the icon set lazily with a dynamic `import("@hugeicons/core-free-icons")` only when the Icons view or an Icon element with a non-registry name is first shown (follow the lazy pattern of components/ui/icon-extended.tsx / preloadExtendedIcons). Render with `HugeiconsIcon` from @hugeicons/react.
4. Drag an icon tile to the canvas or click it → creates an `Icon` element (existing type) with `props.name` = the Hugeicons export name (e.g. `ArrowRight01Icon`), default 24×24, colour currentColor; badge label «Icon · arrow right 01».
5. Inspector for an Icon element: the current icon with a «Сменить» button opening the same searchable picker in a popover; size (16/20/24/32/48) and colour (theme foreground, muted, primary, custom hex) props.
6. `ElementFace` renders Icon elements from Hugeicons by `props.name` (fallback to the current registry Icon for older files that used registry names like "Star").
7. Tests (node:test, .ts only): `src/studio/prototype/icons.ts` with the name→search-words helper and the filter function; `icons.test.ts`.
Check the plugin bundle size before/after (`npm run build`, size of dist/app.js) and report it; main bundle must not grow by more than ~150 KB.

## Completion
- [x] Add the searchable Hugeicons library and place selected icons on the canvas.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-icons-library`).
