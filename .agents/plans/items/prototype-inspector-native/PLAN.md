# Prototype inspector: native Axure-like Style panel

Owner: in our right pane Fill, colour, radius, font size, alignment are plain text fields (raw «left/center/right», hex typed as text) — unclear. In Axure (owner screenshots; also `.bb/chats/thr_wdpmipwdxc/artifacts/axure-re/index.md` §4 and screenshots there) the Style tab is a set of compact, collapsible sections with icons and real pickers.

Rebuild the Style tab (inspector.tsx and helpers) as:
1. **Header**: element name (editable inline) + visibility eye.
2. **Align row**: 9 icon buttons (align left/centre/right, top/middle/bottom, distribute H/V, tidy grid) with tooltips — reuse the align helpers.
3. **Geometry grid** (2 rows, labels as small muted prefixes inside the inputs): X, Y, rotation (rotate icon prefix, «°» suffix); W, lock-aspect toggle icon between W and H, H, corner radius (radius icon prefix), fit-to-content icon button. Number inputs support ↑/↓ (Shift ×10) and drag-scrub on the label.
4. **Collapsible sections** with a header row (title + chevron), state remembered: «Ограничения размеров» (pin box + fix width/height toggles), «Стиль элемента» (named style dropdown — at least Default + user-saved), «Прозрачность» (slider + % input), «Текст» (font family dropdown with ~12 system/web fonts shown in their own face — Inter, System UI, Arial, Helvetica, Georgia, Times New Roman, Roboto, Open Sans, Montserrat, PT Sans, PT Serif, Courier New; weight dropdown Thin…Black; size combo with presets 10–72; colour swatch; line height (auto); text-align icon buttons left/centre/right/justify; vertical-align icon buttons top/middle/bottom; bold/italic/underline toggles), «Заливка» (colour swatch + hex + opacity, image fill button), «Граница» (swatch, width, style solid/dashed/dotted, sides picker), «Тень» (enable checkbox, swatch, X, Y, blur, spread), «Отступы» (4 inputs with a linked toggle).
5. **Colour picker component** (`components/ui/color-picker.tsx` or in prototype/): swatch button opening a popover with saturation/hue picker (no new dependency; a small canvas-free implementation with gradients), hex/RGB input, opacity, document colours and theme presets, eyedropper button where `window.EyeDropper` exists. Used for all colour fields; no raw hex-only fields remain.
6. Multi-selection shows «Несколько элементов» with mixed values blank.
7. All labels via i18n (RU and EN) — no raw English tokens like left/center/right/fill in the UI.
Keep values in the existing `element.style` model. Tests for pure helpers (colour parse/format hex↔rgba↔hsv, font list, scrub math) in a `.ts` module.

## Completion
- [x] Deliver the native Axure-like Style panel with icon controls, pickers, fonts, and colour picker.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-inspector-native`).
