---
title: Office Viewer API
type: component
created: 2026-10-13
updated: 2026-10-18
status: active
confidence: high
tags: [api, rpc, routes]
sources:
  - server.ts
  - src/server/locate.ts
  - src/html/capture.ts
  - app.tsx
  - src/spreadsheet/opener.tsx
  - src/media/media.tsx
  - src/studio/prototype/builder.tsx
  - src/studio/slides/editor.tsx
  - src/studio/paint/paint.tsx
  - src/server/hugeicons.ts
  - src/word/document.tsx
  - src/pdf/pdf.tsx
---

# Office Viewer API

TL;DR: The plugin exposes typed RPC for file access and Studio tools, plus GET assets for PDF.js, HTML screenshots and prototype previews (`server.ts:69-321`; `server.ts:356-460`).

## Purpose

The API connects BB file openers and thread tools to preview, file, asset and persistence operations on the owning BB host (`server.ts:462-569`; `server.ts:571-933`).

## How it works

The server declares request/response schemas with Zod in `rpcContract`, then registers implementations through `bb.rpc.register` (`server.ts:48-321`; `server.ts:462-479`). File methods accept a `source`, path and optional locale; the resolver maps the source to a host and absolute path (`server.ts:48-58`; `src/server/locate.ts:91-133`). Studio methods use the current `threadId` to find thread storage and read or write tool files (`server.ts:120-321`; `server.ts:571-621`).

## Modes

RPC calls use BB's plugin SDK. HTTP routes serve versioned PDF.js/screenshot assets, prototype schema and icon data, and published prototype HTML/JSON (`server.ts:363-460`).

## Failures and compensation

Invalid RPC payloads fail schema validation; location, missing-file, host-unavailable, parse and write errors propagate through handlers, with selected file errors rewritten to include host/path context (`server.ts:48-67`; `server.ts:344-354`; `server.ts:480-569`). `save` returns `conflict` when the read hash differs or BB's conditional write reports a conflict (`server.ts:548-569`). Versioned asset routes return 304 for a matching ETag (`server.ts:363-382`).

## Routes

| Method | Path | Caller | Purpose |
|---|---|---|---|
| GET | `/pdfjs/pdf.min.mjs` | PDF opener | Serves PDF.js runtime; ETag uses the package version (`server.ts:360-370`; `src/pdf/pdf.tsx:54-62`). |
| GET | `/pdfjs/pdf.worker.min.mjs` | PDF.js worker loader | Serves PDF.js worker module; ETag uses the package version (`server.ts:363-370`; `src/pdf/pdf.tsx:54-62`). |
| GET | `/capture/modern-screenshot.js` | HTML screenshot code | Serves screenshot library with version ETag and CORS header (`server.ts:374-382`; `src/html/capture.ts:6-8`). |
| GET | `/prototype/wireframe-schema.md` | Prototype agent setup | Serves the wireframe schema guide (`server.ts:385-394`). |
| GET | `/prototype/wireframe.schema.json` | Prototype agent setup | Serves the JSON schema (`server.ts:389-402`). |
| POST | `/prototype/hugeicons` | Prototype icon picker | Filters and loads requested Hugeicons (`server.ts:404-415`; `src/server/hugeicons.ts:6-34`). |
| GET | `/prototype/preview/:threadId/:stem` and `/index.html` | Published prototype player | Returns published player HTML after checking thread storage and publish metadata (`server.ts:418-446`). |
| GET | `/prototype/preview/:threadId/:stem/data.json` | Published prototype player | Returns published wireframe JSON (`server.ts:448-460`). |

## RPC methods

### File access

| Method | Caller | Purpose |
|---|---|---|
| `open` | File openers | Resolves file source and requests a short-lived preview URL (`server.ts:69-74`; `server.ts:505-516`). |
| `docText` | Legacy `.doc`/`.dot` Word opener | Reads and extracts body, headers, footnotes and endnotes; rejects files larger than `MAX_BYTES` (30 MiB) (`server.ts:46`; `server.ts:480-503`). |
| `siblings` | Image opener | Lists visible file names in the image's containing directory (`server.ts:84-88`; `server.ts:517-525`). |

### Computation and writes

| Method | Caller | Purpose |
|---|---|---|
| `engine` | Spreadsheet opener | Returns base64 IronCalc WASM module, cached in the server process (`server.ts:82-83`; `server.ts:471-478`). |
| `writeImage` | Image editor | Writes base64 image content to the owning host (`server.ts:89-95`; `server.ts:527-547`). |
| `save` | Spreadsheet opener | Applies cell edits; write and conflict behavior is documented in [Spreadsheet editing](features/spreadsheets.md) (`server.ts:106-118`; `server.ts:548-569`). |

### Studio

Prototype persistence and export: `saveWireframe`, history operations, `listWireframes`/`loadWireframe`, asset and design-file reads, publishing, deliverables, and exports are declared in the contract (`server.ts:119-296`) and implemented in RPC registration (`server.ts:571-839`). Slide decks use `saveSlides`, `listSlides` and `loadSlides` (`server.ts:300-320`; `server.ts:885-933`). Paint uses `savePaint`, `listPaints` and `loadPaint` (`server.ts:278-299`; `server.ts:831-884`).

## Business rules

- File input `path` is 1–8192 characters; source kind is `host`, `thread-storage` or `workspace`; identifiers are bounded to 256 characters (`server.ts:48-58`).
- `docText` reads resolved paths, rejects absent content, rejects files over `MAX_BYTES` (30 MiB), and wraps extraction failures in localized errors (`server.ts:480-503`).
- Image write rejects names containing `/` or beginning with `.`, and when overwrite is false checks the requested name plus 98 numbered alternatives (`server.ts:527-547`).
- Save outcome fields are `written` with SHA-256 and byte size or `conflict`; concurrency behavior is documented in [Spreadsheet editing](features/spreadsheets.md) (`server.ts:114-118`; `server.ts:548-569`). Edit bounds are set in the input schema (`server.ts:60-67`; `server.ts:106-118`).

## Public API

The public surface is the RPC contract and HTTP paths listed above; implementations and callers are cited in those tables (`server.ts:69-321`; `server.ts:363-460`).

## Package shape

`server.ts` owns route registration, payload validation and handler implementations; `src/server/locate.ts` resolves BB file source context; file openers and Studio tools call their corresponding methods (`server.ts:356-479`; `src/server/locate.ts:91-133`; `src/studio/prototype/builder.tsx:1264-1303`).

## Internal model

The RPC contract carries BB file-source identity separately from a path. `locate` resolves that identity into `{hostId, absPath, rootPath}` before a file operation (`server.ts:48-58`; `src/server/locate.ts:14-20`; `src/server/locate.ts:91-133`).

## Dependencies

Zod validates contract inputs/outputs; BB Plugin SDK supplies RPC and HTTP registration; file operations use BB SDK file, host, thread, environment and project services (`server.ts:3-4`; `server.ts:356-479`; `src/server/locate.ts:22-36`).

## Gotchas

- HTTP routes are registered inside plugin initialization separately from the RPC contract (`server.ts:356-460`; `server.ts:462-479`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer gotchas](gotchas.md)
- [Office Viewer overview](overview.md)
