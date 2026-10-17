# Prototype: calmer palette tiles and on-canvas hover/selection

Owner feedback (screenshots): the palette tiles have heavy borders around the preview and around the caption — «аляписто», the frames get in the way of seeing the element; the caption under the preview looks clumsy. Reference: Axure's library grid — no boxes at all: a preview/icon and a small caption under it; the tile only lights up on hover (soft tinted background, rounded) and shows a clear selected state.

Palette (src/studio/prototype/builder.tsx palette section, palette.ts if needed):
1. Remove every border on tiles and on the preview area. A tile = preview (≈ 64×40, centered, no background box) + caption under it: text-[11px] leading-tight, text-muted-foreground, centered, up to 2 lines (line-clamp-2, no single-line ellipsis), word-break normal.
2. Tile padding p-1.5, rounded-lg; hover: bg-accent/60 (or bg-muted) and caption text-foreground; focus-visible ring; pressed/dragging: bg-primary/10 + ring-1 ring-primary/40; the tile last clicked/added stays highlighted briefly (300 ms) for feedback.
3. Group headers: smaller (text-xs font-medium uppercase tracking-wide text-muted-foreground), chevron size-3.5, less vertical gap; grid gap-1; 3 columns as now (auto-fill minmax(72px,1fr)).
4. Previews: render slightly bigger and crisper (scale to fit 64×40 with 4px inset), no extra frame; Container preview shows a dashed outline only inside the preview itself.

Canvas (same file / elements.tsx):
5. Elements on the canvas have no permanent outline. Hover: a thin 1px outline in the primary colour at 50% opacity plus the name badge appearing (when badges are off). Selected: 1.5px solid primary outline with the 8 square handles (white fill, primary border, 6px) — only the selected element shows handles. Multi-select: each outlined, one bounding box with handles around the group.
6. Name badges (when on): smaller and quieter — 10px text, rounded-sm, bg-foreground/80 text-background, placed just above the element's top-left outside the box, never covering content; on the selected element the badge uses the primary colour.
Keep all behaviour (drag, resize, inline edit, shortcuts) as is. Light and dark via theme tokens.

## Completion
- [x] Remove cluttered palette and canvas frames and show hover/selection highlights.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-calm-tiles`).
