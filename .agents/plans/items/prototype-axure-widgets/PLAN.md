# Prototype: full Axure-standard widget set

Owner: «все элементы, которые есть в Axure, перенеси — это стандартный набор». Axure Default library groups (owner screenshots): Common, Dynamic, Forms, Menus and table, Markup; plus the Flow library. We keep our own names (A2UI-style types) and existing types; add the missing ones. Wireframe format stays `version: 1` — new types are additive; `parseWireframe` accepts them.

## New element types (model.ts catalog + elements.tsx renderer + inspector FIELDS in builder.tsx)
- Common: `Box` (props: fill none|light|dark|custom, border, radius, text), `Ellipse` (fill, border, text), `Placeholder` (crossed box, text), `Label` (small text), `Paragraph` (multi-line text), `Line` (orientation horizontal|vertical, stroke, dashed).
- Dynamic: `DynamicPanel` (props: states: string[], active: string; renders the active state's title and a light frame; inspector edits states; v1: states are just names — content per state is out of scope), `Repeater` (props: layout table|cards, columns: string[], rows: number, data: string[][] optional; renders a table or a card grid with repeated sample data), `HotSpot` (transparent clickable area, dashed outline only in the editor, props: link/note), `InlineFrame` (props: url; renders a framed placeholder with the URL, no live iframe), `Snapshot` (props: target page/name; renders a framed placeholder with a camera mark).
- Forms: `ListBox` (items, selected), `SearchField`, `DatePicker` (placeholder date + calendar icon), `FileUpload` (dropzone look).
- Menus and table: `Tree` (props: nodes as indented lines text «Item\n  Child»; renders expandable tree look), `Menu` (props: orientation horizontal|vertical, items), `Breadcrumbs` (items), `Pagination` (pages, current).
- Content: `Progress` (value 0-100), `Alert` (variant info|success|warning|error, title, text), `Tooltip` (text, placement).
- Markup: `Arrow` (orientation horizontal|vertical, stroke), `Sticky` (color yellow|blue|green|pink, text), `Marker` (shape circle|drop, number/text, color).
- Flow: one type `Shape` with `props.shape` ∈ rectangle, stacked-rectangle, rounded, stacked-rounded, beveled, diamond, file, stacked-file, bracket, semicircle, triangle, trapezoid, ellipse, hexagon, parallelogram, actor, database, subroutine, delay, document, multi-document, off-page, manual-input, stored-data, internal-storage, offline-storage, display, sort, collate, summing-junction, logical-or, magnetic-tape, punched-tape, punched-card, keying; plus `text`, fill, stroke. Render each as an inline SVG path that scales to w×h (preserveAspectRatio none for the outline, text centered as HTML on top).

## Palette
Regroup (RU/EN): Основные (Common), Динамические (Dynamic), Формы (Forms), Меню и таблицы (Menus and table), Содержимое (Content), Разметка (Markup), Блок-схемы (Flow — collapsed by default). Variants as palette entries (palette.ts) with props presets: Box 1/2/3, Primary/Link button, Heading 1/2/3, Sticky 1–4, Circle/Drop marker, horizontal/vertical Line and Arrow, Repeater table/cards, Menu horizontal/vertical, each Flow shape. Existing types keep working; existing saved files open unchanged.
Tile previews keep using the current renderer for now; a later task swaps in designed pictograms — keep a `pictogram?: string` key on each palette entry (kebab-case id, e.g. `checkbox`, `heading-1`, `flow-diamond`, `sticky-1`) so that swap is a lookup.

## Inline editing and badges
Double-click text editing works for the new types with text (Box, Ellipse, Label, Paragraph, Sticky, Shape, Alert, Tooltip); item lists (ListBox, Menu, Breadcrumbs, Tree lines) follow the existing Enter-adds-item behaviour. Badges show `Type · label` as now.

## Tests
Extend model/palette tests: every palette entry builds a valid element that round-trips through parseWireframe; every Shape value has an SVG path generator returning a non-empty path for a 100×60 box (pure function in `src/studio/prototype/shapes.ts`, test `shapes.test.ts`).

## Completion
- [x] Add the Axure-standard widget groups, including Markup and Flow shapes.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-axure-widgets`).
