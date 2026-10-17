# Office Studio: keep work when the panel is hidden and reopened (autosave + restore)

Owner: opened the Prototype in a chat, did some work, hid the right panel, opened it again — everything was gone. The Studio tab component unmounts when the panel closes and all state lives in React state.

Do, for all three tools (Prototype, Paint, Slides) and the launcher:
1. **Session store per thread**: a small module `src/studio/session.ts` keeping, per threadId, the last picked tool and, per tool, the working document + view state (prototype: active page, zoom, scroll, selection, pane sizes, palette view/search; paint: canvas, tool, colour, width; slides: active slide, zoom). Kept in memory (module-level Map, survives unmount while the app lives) and mirrored to `localStorage` (`office-studio.session.<threadId>`, debounced 500 ms, size-capped; documents larger than ~2 MB are not mirrored there, only autosaved to files below).
2. **Autosave to the chat's files**: every change is autosaved (debounced 2 s, and on unmount/visibilitychange/pagehide) to the thread storage via the existing save RPCs:
   - a document already saved/opened → saved back to its own file (`Prototypes/<name>.wireframe.json` + PNG refreshed at most every 30 s; Paint/<name>…; Slides/<name>…);
   - a new unsaved document → `Prototypes/Без названия.wireframe.json` (Paint/Slides likewise), name made unique; renaming via «Сохранить как» moves it.
   A small status in the toolbar: «Сохранено» / «Сохранение…» / «Не сохранено — повторить» with time on hover.
3. **Restore on open**: when the Studio tab mounts for a thread it reopens the last tool with its document and view state (memory → localStorage → last autosaved file of that tool in thread storage), so hiding/showing the panel, switching chats and reloading BB all bring the work back. «Новый» starts a new document explicitly (asking to keep/close the current one only if it has unsaved changes and autosave failed).
4. Undo history survives unmount within the session (memory store), not across reloads.
5. Tests (node:test, .ts): session store get/set/serialise with caps, debounce/flush helper with fake timers, restore precedence (memory > localStorage > file list newest).

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `studio-autosave-restore`).
