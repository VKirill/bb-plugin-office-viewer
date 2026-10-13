---
title: Office Viewer API
type: component
created: 2026-10-13
updated: 2026-10-13
status: active
confidence: medium
tags: [api, rpc, routes]
sources:
  - server.ts
  - src/server/locate.ts
  - app.tsx
  - src/spreadsheet/opener.tsx
  - src/media/media.tsx
  - src/word/document.tsx
  - src/pdf/pdf.tsx
---

# Office Viewer API

TL;DR: The plugin exposes six typed BB RPC methods and two GET routes for PDF.js assets; frontend openers call RPC through BB's plugin SDK (`server.ts:39-79`; `server.ts:118-132`).

## How it works

The server declares request/response schemas with Zod in `rpcContract`, then registers implementations through `bb.rpc.register` (`server.ts:18-79`; `server.ts:132-233`). File methods accept a `source`, relative or absolute `path`, and optional `locale`; the resolver maps the source to a host and absolute path (`server.ts:18-29`; `src/server/locate.ts:91-133`).

## Modes

RPC is called through BB's plugin SDK from the frontend; the PDF.js asset routes are GET requests mounted on the plugin HTTP server (`server.ts:118-132`). No app-level user authorization logic appears in the route or handler registration (`server.ts:114-132`).

## Failures and compensation

Invalid RPC payloads fail schema validation; location, missing-file, host-unavailable, parse and write errors propagate through their handlers, with selected file errors rewritten to include host/path context (`server.ts:18-37`; `server.ts:102-112`; `server.ts:142-231`). `save` returns `conflict` if the file hash changed before the read or conditional write; it does not overwrite that version (`server.ts:210-231`). PDF.js asset requests return 304 when the request ETag matches the package version (`server.ts:121-129`).

## Routes

| Method | Path | Caller | Purpose | Auth |
|---|---|---|---|---|
| GET | `/pdfjs/pdf.min.mjs` | PDF opener's dynamic PDF.js import | Serves PDF.js library module with ETag (`server.ts:118-129`; `src/pdf/pdf.tsx:1-3`). | No app-level auth check in this handler (`server.ts:121-129`). |
| GET | `/pdfjs/pdf.worker.min.mjs` | PDF.js worker loader | Serves PDF.js worker module with ETag (`server.ts:118-129`; `src/pdf/pdf.tsx:1-3`). | No app-level auth check in this handler (`server.ts:121-129`). |

## RPC methods

### File access

| Method | Caller | Purpose | Auth |
|---|---|---|---|
| `open` | Spreadsheet, media, Word, slides and PDF openers | Resolves file source and requests a short-lived preview URL (`server.ts:41-44`; `server.ts:167-177`). | BB RPC transport; no handler-level identity check (`server.ts:132-177`). |
| `docText` | Legacy `.doc`/`.dot` Word opener | Reads file and extracts body, headers, footnotes and endnotes (`server.ts:45-50`; `server.ts:142-165`). | BB RPC transport; no handler-level identity check (`server.ts:132-165`). |
| `siblings` | Image opener | Lists visible file names in the image's containing directory (`server.ts:54-58`; `server.ts:179-188`). | BB RPC transport; no handler-level identity check (`server.ts:132-188`). |

### Computation and writes

| Method | Caller | Purpose | Auth |
|---|---|---|---|
| `engine` | Spreadsheet opener | Returns base64 IronCalc WASM module, cached in the server process (`server.ts:52-53`; `server.ts:132-141`). | BB RPC transport; no handler-level identity check (`server.ts:132-141`). |
| `writeImage` | Image editor | Writes base64 image content to an owning host path (`server.ts:59-65`; `server.ts:189-208`). | BB RPC transport; no handler-level identity check (`server.ts:132-208`). |
| `save` | Spreadsheet opener | Applies cell edits to XLSX/CSV and conditionally writes against expected SHA-256 (`server.ts:66-78`; `server.ts:210-231`). | BB RPC transport; no handler-level identity check (`server.ts:132-231`). |

## Business rules

- File input `path` is 1–8192 characters; source kind is `host`, `thread-storage` or `workspace`; identifiers are bounded to 256 characters (`server.ts:18-29`).
- `docText` and `open` reject source paths that cannot be mapped or read; `docText` rejects files over 30 MiB (`server.ts:142-153`).
- Image write rejects names containing `/` or beginning with `.`, and returns a unique suffixed name if overwrite is false (`server.ts:189-208`).
- Save returns `written` with SHA-256 and byte size or `conflict`; edit payload bounds are defined by the schema (`server.ts:30-37`; `server.ts:66-78`).

## Public API

The public surface is the RPC contract and the two GET paths listed above; implementations and callers are cited in those tables (`server.ts:39-79`; `server.ts:118-132`).

## Package shape

`server.ts` owns route registration, payload validation and handler implementations; `src/server/locate.ts` resolves BB file source context; each opener calls only the methods required by its interaction (`server.ts:114-132`; `src/server/locate.ts:91-133`).

## Internal model

The RPC contract carries BB file-source identity separately from a path. `locate` resolves that identity into `{hostId, absPath, rootPath}` before a file operation (`server.ts:18-29`; `src/server/locate.ts:14-20`; `src/server/locate.ts:91-133`).

## Dependencies

Zod validates contract inputs/outputs; BB Plugin SDK supplies RPC and HTTP registration; file operations use BB SDK file, host, thread, environment and project services (`server.ts:3-4`; `server.ts:114-132`; `src/server/locate.ts:22-36`).

## Gotchas

- The PDF.js paths are registered as GET routes inside plugin initialization, not as RPC methods (`server.ts:118-132`).
- The API page describes handler-level behavior; authentication enforcement is provided by the BB host transport, whose internal policy is outside this repository (`server.ts:114-132`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer gotchas](gotchas.md)
- [Office Viewer overview](overview.md)
