# Prototype: connectors for flowcharts (Axure Connector tool, E)

Source: `.bb/chats/thr_wdpmipwdxc/artifacts/axure-re/index.md` (toolbar «Connector (E)», Flow library) and data-model.md. Our Flow shapes exist (type Shape); there is no way to link them.

1. Model: new element type `Connector` (additive, format unchanged in version): `props: {from?: {id, anchor: top|right|bottom|left|auto}, to?: {id, anchor}, points?: [x,y][] for free ends, routing: straight|elbow|curved, startArrow: none|arrow|dot, endArrow: none|arrow|dot, dashed, label?: string}`; stroke style from element.style.
2. Tool: E (and a toolbar button + palette entry «Соединитель» in Блок-схемы) — drag from one element to another; hovering an element shows 4 anchor dots; releasing on an element attaches, on empty space leaves a free end. Connectors re-route live when attached elements move/resize; deleting an element detaches (free end keeps last point).
3. Select a connector: endpoints draggable (re-attach), midpoint handle to bend elbow routes; double-click edits the label (centred on the path, with background).
4. Inspector Properties: routing, arrowheads, dashed, label; Style: colour, width.
5. Render as SVG over the canvas below selection layer; PNG export and Slides include connectors.
6. Pure geometry in `src/studio/prototype/connectors.ts` (anchor points, elbow routing avoiding the two boxes, path string, label position) + `connectors.test.ts`.

## Completion
- [x] Prototype: connectors for flowcharts (Axure Connector tool, E).

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-connectors`).
