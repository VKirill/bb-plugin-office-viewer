# Paint in Office Studio

Canonical plan: .agents/plans/2026-10-17-office-studio.md; research section 4.2 in .bb/chats/thr_wdpmipwdxc/artifacts/axure-analog-research.md. Replace the `PaintTool` placeholder in src/studio/tools.tsx.

Reuse src/media/image-editor.tsx (pen, marker, shapes, arrows, text, numbered steps, undo, PNG export) instead of writing a new editor:
1. Blank-canvas mode: `ImageEditor` (or a thin wrapper `src/studio/paint/paint.tsx`) starts from a blank canvas with a chosen size (presets 1280×800, 1920×1080, 800×800, custom) and background (white, transparent, dark). Keep the file-opener and chat-editor behaviour of the image editor exactly as now.
2. Brush: smooth pressure-style strokes with `perfect-freehand` (add the dependency, MIT, ~2 KB) for the pen tool; stroke width picker with more sizes (e.g. 1–24) and a colour picker (existing palette + custom colour input).
3. Eraser tool (object eraser: removes shapes it touches).
4. Save to `<thread storage>/Paint/<name>.png` plus a sidecar `<name>.paint.json` with the shapes so the drawing stays editable; reopen from a list of the thread's drawings (reuse the storage RPC pattern of the prototype builder in server.ts if present, else follow writeImage in server.ts).
5. «Send to chat» attaches the PNG via `composer.experimental_vkAttachFiles` with the same fallback as the image editor.
6. i18n en+ru for new strings.
7. Tests: `src/studio/paint/paint-model.test.ts` (node:test) for the sidecar parse/serialize and the eraser hit test kept in a plain .ts module (`src/studio/paint/paint-model.ts`).

## Completion
- [x] Deliver blank-canvas Paint with smooth brush, eraser, save/open, and send-to-chat support.

### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `paint-canvas`).
