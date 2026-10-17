# Fix: Icons library shows names but no icons

Root cause (verified in dist/app.js): `src/studio/prototype/hugeicons-runtime.ts` loads each icon with `import(/* @vite-ignore */ \`@hugeicons/core-free-icons/${name}\`)`. `bb plugin build` emits a single bundle, so this bare-specifier dynamic import stays in dist/app.js as `import(\`@hugeicons/core-free-icons/${e}\`)` and fails in the browser — every tile renders only its caption (owner screenshot: «a arrow down», «abacus»… with empty space above).

Fix without putting all icons into the main app bundle:
1. Serve icon data from the plugin server: in server.ts add `bb.http.route("GET", "/icons/:name"…)` or a batched RPC `iconData({names: string[]})` (follow the existing `/pdfjs/` and `/capture/` routes) that returns the IconSvgElement arrays for the requested Hugeicons export names, read from `@hugeicons/core-free-icons` on the server side (a static import of the package into server.js is acceptable; validate names against HUGEICON_NAMES, max 200 per batch, cache headers immutable).
2. Client `hugeicons-runtime.ts`: replace the bare dynamic import with a batched fetch/RPC (collect names requested in the same animation frame, one request per batch, in-memory cache, notify subscribers). Keep the API (`ensureHugeiconLoaded`, `getHugeiconSvg`, subscribe) so icons-library.tsx, icon-inspector.tsx and proto-icon.tsx keep working.
3. Make sure nothing in dist/app.js contains `import(\`@hugeicons` after `npm run build` (add this grep to the report), and that Icon elements on the canvas, the inspector picker and the PNG export show the icon.
4. Test (node:test, .ts): the batching/caching helper with a fake fetcher.

## Completion
- [x] Fix Hugeicons loading so icons render in the library, elements, and picker.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-icons-fix`).
