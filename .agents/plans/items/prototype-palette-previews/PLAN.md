# Prototype palette with live previews (Axure style)

Owner's reference: Axure's Libraries panel shows a grid of tiles, each a small visual preview of the widget with its name under it (Box, Image, Button, Primary Button, Heading 1…), not a list of text buttons. Current palette in src/studio/prototype/builder.tsx (≈ lines 41 and 600–660) is a vertical list of full-width text buttons.

Do:
1. Palette becomes a grid of tiles (3 columns at the default palette width, auto-fill `minmax(76px,1fr)`), grouped by the existing groups with collapsible group headers (chevron, remember open state in component state). Search filters tiles and keeps matching groups.
2. Each tile: a preview area (~64×44) rendering the real element with `ElementFace` (src/studio/prototype/elements.tsx) using `defaultElement(type,0,0)` scaled down with CSS transform to fit (keep aspect ratio, centered, pointer-events none, no badge), and below it the element name (small text, one line, ellipsis; RU/EN friendly name via i18n, e.g. «Кнопка», «Поле ввода», «Выпадающий список»; `title` tooltip shows the type name like `ChoicePicker`).
3. Tile states: hover background, focus-visible ring, cursor grab; drag from the tile to the canvas and click-to-add work exactly as now. While dragging, the drag image is the element preview (setDragImage of the preview node) if simple; otherwise keep the default.
4. Add a few Axure-like variants as separate palette entries only if they map to existing types via default props (e.g. Primary Button / Link Button = Button with variant; Heading 1/2/3 = Heading with level; Image placeholder) — keep the model's type names unchanged so saved files and agent vocabulary stay stable. A variant entry = `{type, props}` in a small catalog list next to the existing catalog.
5. Unit test in src/studio/prototype/model.test.ts (or a new palette.test.ts importing only .ts): every palette entry builds a valid element via defaultElement + props and parses with parseWireframe.
Keep light and dark theme with theme tokens. Do not change canvas, inspector, save/send.

## Completion
- [x] Show palette elements as visual preview tiles with names.

### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-palette-previews`).
