# Prototype builder (Axure analog) — MVP

Canonical plan: .agents/plans/2026-10-17-office-studio.md; research: .bb/chats/thr_wdpmipwdxc/artifacts/axure-analog-research.md (sections 2–4.1). Replace the `PrototypeTool` placeholder in src/studio/tools.tsx (created by studio-launcher) with the real builder in `src/studio/prototype/`.

## Model (`src/studio/prototype/model.ts`, plain TS, zod)
`Wireframe = { format: "bb-wireframe", version: 1, name, canvas: {width, height, background}, elements: Element[] }`, `Element = { id, type, label, x, y, w, h, props: Record<string, string|number|boolean|string[]>, note?: string }`. `type` uses A2UI-style names: Header, Nav, Text, Heading, Button, TextField, TextArea, ChoicePicker (select), Checkbox, Radio, Switch, Slider, Card, Image, Avatar, Icon, Badge, Table, List, Tabs, Modal, Divider, Container. Each type has a catalog entry (default size, default props, palette group: Layout, Inputs, Content, Navigation). `label` defaults to the type name + number («Button 1») and is editable. Export `parseWireframe`, `newWireframe`, `defaultElement(type, x, y)`, `snap(v, 8)`.

## Editor (`src/studio/prototype/builder.tsx` + small files)
- Left: palette grouped by category with search; drag an item onto the canvas (or click to add at center).
- Center: canvas (default 1280×800, presets Desktop 1280, Tablet 768, Phone 375) with zoom, 8px grid snap. Elements render as real-looking UI using the plugin's Tailwind/theme tokens (and components/ui/button, input, card where they fit), non-interactive.
- Every element has a small name badge at its top-left corner (pill, e.g. `Button · Sign in`), toggle «Badges» on/off in the toolbar; badges are included in the PNG export when on.
- Select, multi-select (shift), move by drag and arrow keys, resize by 8 handles, delete, duplicate (Cmd+D), copy/paste, bring forward/back, undo/redo (Cmd+Z / Shift+Cmd+Z, ≥ 60 steps).
- Right: inspector for the selected element: label, text/props for its type (button text and variant, field placeholder, options list, table columns/rows count, etc.), x/y/w/h, a note (annotation, Axure-style) shown as a numbered marker.
## Files and chat
- Save: RPC in server.ts (follow `writeImage`, server.ts:75 and :219-238) writes `<thread storage root>/Prototypes/<name>.wireframe.json` and `<name>.png` using `bb.sdk.threads.storageLocation({threadId})` + `bb.sdk.files.write` (createParents, free `-N` suffix unless overwriting the opened file). Open: list `Prototypes/*.wireframe.json` of the thread and load one; New.
- PNG export: `modern-screenshot` (already a dependency) of the canvas at 2x.
- «Send to chat»: attach the PNG and the JSON via `composer.experimental_vkAttachFiles` (feature-tested like src/media/image-editor.tsx:611-645); fallback: save both and insert into the composer text `Prototype: <abs json path> (screenshot: <abs png path>)`. Options in a small menu: screenshot only, file only, both (default both).
- Also add a fileOpener for `*.wireframe.json` only if the SDK opener can match that suffix; otherwise skip (note it in the report).
- i18n en+ru for all new strings in src/shared/i18n.ts.

## Tests
`src/studio/prototype/model.test.ts` (node:test, imports only .ts): parse/validate round trip, defaults per type, label numbering, snap, rejecting a bad file.

## Completion
- [x] Build, save/open, export, and send UI prototypes with element badges.

### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-builder`).
