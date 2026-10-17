# Prototype: proper alignment icons and tooltips

Owner screenshot (Style panel, src/studio/prototype/inspector-style-panel.tsx): the align/distribute buttons are hand-drawn glyphs (|‾, ┼, ‾|, a dashed line, a dotted bar) in a 3×3 grid with the lock-aspect toggle mixed in among them, and the tooltip «По левому краю» renders as a grey box overlapping the next icon in the middle of the grid. Same glyphs probably in toolbar.tsx.

Fix:
1. Use real Hugeicons glyphs (free set, already a dependency; register them in components/ui/icon-registry.ts / icon-extended.tsx following the existing pattern): align left `LayoutAlignLeftIcon`, centre horizontally `AlignHorizontalCenterIcon`, right `LayoutAlignRightIcon`, top `LayoutAlignTopIcon`, middle `AlignVerticalCenterIcon`, bottom `LayoutAlignBottomIcon`, distribute horizontally `DistributeHorizontalCenterIcon`, distribute vertically `DistributeVerticalCenterIcon`. Same icons in the toolbar align menu/buttons and in the text-alignment controls use the text-align set (`TextAlignLeftIcon`… if present, else the closest Hugeicons text-align icons). No hand-drawn SVG glyphs remain for these actions.
2. Layout like Axure: one row of 8 equal icon buttons (28 px, size-4 icons, gap-0.5) above the geometry grid; if the panel is narrower, two rows of 4 (left/centre/right/distribute-H, top/middle/bottom/distribute-V). The lock-aspect toggle is NOT in this row — it sits between W and H in the geometry grid.
3. Tooltips: use one shared tooltip component (Radix tooltip if available in devDependencies, else a small positioned popover) — appears above the button after 400 ms, with arrow, `bg-popover text-popover-foreground shadow-md text-xs`, never overlapping as a static block; label + shortcut, e.g. «По левому краю ⌥⌘L». Apply this tooltip to every icon button in the prototype toolbar and inspector (replace ad-hoc `title`-like boxes).
4. Disabled state when nothing (or for distribute, fewer than 3 elements) is selected: 40 % opacity, no hover.

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-align-icons`).

## Completion
- [x] Prototype: proper alignment icons and tooltips.
