# Office Studio launcher redesign with logos

Port the design-lead's approved mockup 1:1. Design files (read them all): `.bb/chats/thr_wdpmipwdxc/artifacts/studio-design/` — `spec.md` (exact classes, sizes, copy RU+EN), `launcher.html` and `launcher-preview.png` (target look), SVGs `office-studio.svg`, `office-studio-mono.svg`, `prototype.svg`, `paint.svg`, `slides.svg`.

1. `src/studio/logos.tsx`: the five logos as React components (`OfficeStudioLogo`, `OfficeStudioMark` (mono, currentColor), `PrototypeLogo`, `PaintLogo`, `SlidesLogo`), each taking `className`; gradient/def ids unique per instance via `useId()`.
2. `src/studio/studio-panel.tsx`: rewrite the launcher view per spec.md: header (mark + «Office Studio» + subtitle), «Инструменты» label, tool cards with logo tile, title, description, chevron; list layout below ~576 px container width, three columns above (container query as in spec); hover lift, focus-visible ring, active state; Slides disabled with dashed border, faded logo and «скоро» pill; hints box («Сохраняется в файлы чата», «В чат — скриншотом или файлом»). Keep the tool switching and Back behaviour as now.
3. `src/studio/header-action.tsx`: use `OfficeStudioMark` as the header button icon.
4. Panel tab icon: if the SDK lets a plugin register a custom app icon (check `ExperimentalAppIcons` / `ExperimentalIconRegistration` in node_modules/@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk.d.ts), register the mono mark under a name and use it in app.tsx for the threadPanelAction icon; otherwise keep the built-in icon and say so in the report.
5. `src/shared/i18n.ts`: add `studioSubtitle`, `studioToolsLabel`, `studioHintSaved`, `studioHintSend`, and update the Prototype, Paint and Slides descriptions with the RU and EN copy from spec.md.
Both light and dark theme must match the mockup using theme tokens; logos keep their own gradients.

## Completion
- [x] Redesign the Studio launcher to match the approved mockup with studio and tool logos.

### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `studio-launcher-design`).
