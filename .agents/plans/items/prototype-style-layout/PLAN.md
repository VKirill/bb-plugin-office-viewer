# Prototype Style panel: layout polish — no overlapping controls

Owner screenshot (Style tab → Текст section, src/studio/prototype/inspector-style-panel.tsx): the «Насыщенность» select and the «Размер шрифта» select overlap (the weight select's chevron sits on top of the size select's left edge); «Межстрочный интервал 140» is a long label inside one input with an unclear value (140 what?); the text-align icon row below is cramped.

Fix across the whole Style tab (it is ≈260 px wide, can be wider):
1. Every 2-column row uses `grid grid-cols-2 gap-2` and every control inside has `min-w-0 w-full`; selects use one shared compact select style (h-8, rounded-md, border-input, px-2, chevron inside its own box, text truncates) — no fixed widths that exceed the column. Check all rows: geometry grid, typography, fill, border, shadow, padding, opacity.
2. Labels above controls in small muted text (11–12 px), consistent spacing (section padding 12 px, row gap 8 px).
3. Line height: a compact number field with a line-height icon prefix and «%»/«авто» unit — value shown as e.g. «140 %» or «Авто», tooltip «Межстрочный интервал»; same compact style as the size field. Font size: a combo (type or pick) showing «14» with «px» suffix.
4. Text alignment and vertical alignment: two segmented groups of icon buttons (left/centre/right/justify | top/middle/bottom), each 28 px, with the shared tooltip, wrapping into two rows when narrow, never overlapping.
5. Verify visually at panel widths 240, 280 and 360 px in light and dark (take screenshots of the Style tab with a Button selected in a quick local harness or Storybook-like page if available, save to the task report folder) — no control overlaps another.

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-style-layout`).

## Completion
- [x] Prototype Style panel: layout polish — no overlapping controls.
