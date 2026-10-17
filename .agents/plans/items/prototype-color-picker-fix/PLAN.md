# Prototype colour picker: fix and polish

Owner screenshot (Style → Текст → Цвет):
- the text colour field shows «transparent» for an element whose text is clearly dark — the field shows the stored value, not the effective colour;
- the hex field («transparent», monospace) runs past the right edge of the panel;
- the hue slider is a plain grey track with a blue knob — no rainbow, so it is unclear what it does; the opacity slider is also a plain track (no checkerboard → colour gradient);
- the popover has no hex/RGB inputs, sits inside the panel and is clipped at the right edge; the swatch grid is fine.

Fix the shared colour picker (wherever prototype-inspector-native put it — components/ui/color-picker.tsx or src/studio/prototype/) and its use in all Style fields:
1. **Effective value**: when an element has no explicit colour, the field shows the effective default for that element and theme (text → theme foreground; fill → the element's default fill or «Нет»; border → its default border colour) as a swatch + readable value, with a small «по умолчанию» hint; «transparent»/empty is shown as «Нет» with a checkerboard swatch, never as the word «transparent».
2. **Field row**: `[swatch 24px][HEX input, min-w-0, flex-1, text-sm tabular, uppercase, no monospace][opacity % input 48px]` — fits in the column without overflow.
3. **Popover**: rendered in a portal, positioned next to the field (side left of the inspector when there is no room on the right, flips/shift to stay in the viewport, max-width 260 px), with: saturation/value area; hue slider with a rainbow gradient track; opacity slider with checkerboard + colour gradient track; slider knobs as white circles with a border and shadow; a row with a format switch HEX / RGB and the inputs; «Цвета документа» (colours already used in this prototype) and theme presets; «Нет (прозрачный)» swatch; «Пипетка» only where `window.EyeDropper` exists, as a small icon button rather than a full-width button.
4. Keyboard: arrows move the knobs; Enter/Esc close; focus returns to the swatch.
5. Tests for the pure helpers: effective default colour per element type, hex/rgba/hsv conversions, «transparent» → «Нет» display.

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-color-picker-fix`).
