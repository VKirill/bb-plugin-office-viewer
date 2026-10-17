# Office Studio: Slides tool (MVP)

The launcher shows «Слайды — скоро». Build the tool (research: `.bb/chats/thr_wdpmipwdxc/artifacts/axure-research.md` §4.3 — reuse the prototype engine; PptxGenJS for export).

1. `src/studio/slides/`: a deck editor in the Office Studio tab: left — slide thumbnails (add, duplicate, delete, drag to reorder); centre — 16:9 slide canvas (1280×720) reusing the prototype canvas/elements (text, heading, image, shapes, icons, lists, tables) — reuse components from src/studio/prototype/ rather than copying; right — inspector (reuse). Layout presets for a new slide: Титульный, Заголовок и текст, Два столбца, Картинка с подписью, Пустой. Theme: light/dark deck background and accent colour.
2. Presenter: «Показ» opens full-panel presentation mode, ←/→/Space, Esc exits.
3. Save to `<thread storage>/Slides/<name>.slides.json` (reuse the Prototypes save RPC pattern in server.ts), Open list, New. Export: PNG of the current slide, and **.pptx** export via `pptxgenjs` (add the dependency; MIT) with text, shapes, images and tables mapped to native PPTX objects where simple, otherwise a slide image.
4. «В чат»: attach the PPTX and/or PNG of the current slide, same dropdown as the prototype.
5. Launcher: Slides card enabled (remove «скоро»), its tool opens the editor; update src/studio/studio-panel.test.ts if it asserts Slides is disabled.
6. RU/EN strings. Tests (node:test, .ts): deck model parse/round trip, layout presets build valid slides, the PPTX mapping function returns objects for each element kind (pure, without writing a file).

## Completion
- [x] Deliver the Slides deck editor, presenter, PPTX export, save, and send-to-chat.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `studio-slides`).
