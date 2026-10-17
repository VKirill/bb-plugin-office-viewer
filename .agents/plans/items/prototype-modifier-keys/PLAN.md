# Prototype: modifier keys like Figma / Axure / Photoshop

Owner: «добавил прямоугольник, зажал Shift — он стал квадратом; то же с овалом и другими элементами; сделай нативно, как в других программах». Standard behaviour across Figma, Sketch, Axure and Photoshop (Mac ⇧ ⌥ ⌘, Windows Shift Alt Ctrl):

## Drawing new shapes (new)
1. Draw tools: pressing R (rectangle), O (ellipse), L (line), T (text), F (text field) — or picking Box/Ellipse/Line/Shape in the palette with a tool mode — arms the tool; the cursor becomes a crosshair; **drag on the canvas draws the element** from corner to corner (a click places it at default size, as now). Esc disarms.
2. While drawing: **⇧ Shift** = square / circle / 1:1 (lines snap to 0/45/90°); **⌥ Alt** = draw from the centre; **⇧⌥** = both; **Space held** = move the shape being drawn without changing its size; **⌘/Ctrl held** = temporarily ignore snapping.

## Resizing (handles)
3. **⇧** keeps the aspect ratio (corner handles; edge handles scale proportionally from that edge); **⌥** resizes symmetrically from the centre; **⇧⌥** both; **⌘/Ctrl** ignores snapping. Elements whose aspect is locked (inspector lock toggle, and by default Icon, Avatar, circle Marker) keep proportion without Shift; Shift then frees them (Figma behaviour).

## Moving
4. **⇧** while dragging constrains movement to horizontal / vertical / 45° from the start point; **⌥ drag** duplicates (the copy moves, original stays) — already in the plan, make sure it works; **⌘/Ctrl** ignores snapping; Esc during a drag cancels and returns to the start.
5. Arrows nudge 1 px, ⇧+arrows 10 px (keep); ⌘+arrows resize (keep).

## Rotation (if rotation handles exist; else via the rotate field)
6. Rotation drag snaps to 15° steps with ⇧.

## Visual feedback
7. While a modifier is active during a gesture, show a small hint chip near the cursor/size tooltip, e.g. «⇧ пропорции», «⌥ от центра», «⌘ без привязки», «⇧ по оси», «⌥ копия»; the size tooltip shows W×H live.
8. A «Горячие клавиши» sheet: «?» key or the help item in the toolbar «⋯» menu opens a compact overlay listing tools, modifiers and shortcuts (RU/EN, Mac symbols on macOS, Ctrl/Alt on Windows).

## Tests
Pure functions in `src/studio/prototype/canvas-math.ts` (extend): `drawRect(start, current, {shift, alt})`, `resizeBox(box, handle, delta, {shift, alt, locked})`, `constrainMove(delta, shift)`, `snapAngle(angle, shift)`; tests for each modifier combination incl. negative drags (dragging up-left).

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-modifier-keys`).
