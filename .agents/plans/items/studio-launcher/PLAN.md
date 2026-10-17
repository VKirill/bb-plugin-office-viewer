# Office Studio launcher

Canonical plan: .agents/plans/2026-10-17-office-studio.md.

Add an «Office Studio» entry point:
1. `src/studio/studio-panel.tsx`: export `STUDIO_PANEL = "studio"` and `StudioPanel({threadId, params})`. With `params?.tool` in {"prototype","paint","slides"} it renders that tool; otherwise a launcher: three cards (icon, title, one-line description) — Prototype (Axure-like interface builder), Paint (drawing with a brush), Slides (coming soon, disabled with a «soon» badge). Clicking a card switches the tab to that tool in place (local state) and also offers «Back to tools». For now Prototype and Paint render a placeholder component exported from `src/studio/tools.tsx` (`PrototypeTool`, `PaintTool`, each `{threadId}`) that later tasks replace; keep these as the single place the panel imports tools from.
2. `src/studio/header-action.tsx`: `StudioHeaderAction({threadId})`: an icon button in the thread header like bb-plugin-git-history's GitHistoryHeaderAction (../bb-plugin-git-history/app.tsx:1615): `useBbNavigate().openThreadPanel({actionId: STUDIO_PANEL, title: t("studio")})`, toast or console warn when it returns false. Style it like BB's header icon buttons (size-7 ghost button, icon size-4, muted foreground, hover accent). Icon: a builtin that reads as design tools (e.g. "PenTool"/"Palette"/"LayoutGrid" — use a name that exists in components/ui/icon-registry.ts or register one Hugeicons icon there).
3. app.tsx: register `app.slots.threadPanelAction({id: STUDIO_PANEL, title: t("studio"), icon: <same>, layout: "flush", component: StudioPanel})` and `app.slots.experimental_threadHeaderAction({id: "studio", title: t("studio"), component: StudioHeaderAction})` (check the SDK type in node_modules/@get-bb/plugin-sdk/bundled-types/bb-plugin-sdk.d.ts; if the slot is missing at runtime, guard it like the browser toolbar slot in app.tsx).
4. i18n keys (en + ru) in src/shared/i18n.ts: studio, studioPrototype(+Desc), studioPaint(+Desc), studioSlides(+Desc), studioSoon, studioBack.
5. Test `src/studio/studio-panel.test.ts` (node:test): a pure helper `studioToolOf(params)` that maps params to the tool or null.

## Completion
- [x] Add the thread-header launcher and Office Studio panel with tool cards.

### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `studio-launcher`).
