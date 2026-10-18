---
title: PDF viewing
type: component
created: 2026-10-13
updated: 2026-10-18
status: active
confidence: medium
tags: [pdf, search, documents]
sources:
  - src/pdf/pdf.tsx
  - server.ts
  - src/shared/quote.ts
  - app.tsx
---

# PDF viewing

TL;DR: The PDF opener fetches a BB preview, loads PDF.js in the browser and provides page navigation, zoom, search, text selection, quoting and download (`src/pdf/pdf.tsx:239-298`).

## Purpose

Render PDF pages in a continuous viewer, with search and selection features that can pass cited text into the BB composer (`src/pdf/pdf.tsx:239-298`).

## How it works

1. BB routes `.pdf` to `PdfOpener` (`app.tsx:39-44`; `src/pdf/pdf.tsx:27-30`).
2. The opener calls server RPC `open`, fetches file bytes from the returned preview URL and loads the PDF document (`src/pdf/pdf.tsx:284-310`; `server.ts:505-516`).
3. The opener dynamically loads the PDF.js runtime and worker from `/pdfjs/` routes; each handler returns a package-version ETag and responds 304 to a matching `If-None-Match` (`src/pdf/pdf.tsx:54-62`; `server.ts:360-370`).
4. Pages near the visible viewport are rendered and page dimensions are collected in chunks (`src/pdf/pdf.tsx:299-330`).
5. Search highlights matches and keyboard/toolbar controls navigate; selected text is formatted with file and page context for the composer (`src/pdf/pdf.tsx:239-298`; `src/shared/quote.ts:3-10`).

| Mode | Input and output | Failure behavior |
|---|---|---|
| Regular PDF | BB preview bytes rendered by PDF.js (`src/pdf/pdf.tsx:239-298`). | Fetch or PDF.js failures set an error state in the opener (`src/pdf/pdf.tsx:299-330`). |
| Password-protected PDF | PDF.js password callback collects a password and retries loading (`src/pdf/pdf.tsx:239-298`). | Rejected password/error is surfaced in viewer status (`src/pdf/pdf.tsx:299-330`). |
| PDF without text layer | Page rendering remains available; text search/selection depend on extracted text (`src/pdf/pdf.tsx:239-298`). | Search produces no text matches where PDF.js exposes no text. |

## Business rules

- The app opener handles only the `.pdf` extension (`src/pdf/pdf.tsx:27-30`; `app.tsx:39-44`).
- Download requests the original preview URL and triggers a browser download (`src/pdf/pdf.tsx:493-505`).
- PDF.js runtime and worker are separate GET routes (`server.ts:360-370`).

## Public API

| Import or call | File | Purpose |
|---|---|---|
| `PdfOpener` | `src/pdf/pdf.tsx:239-298` | PDF viewer UI and lifecycle. |
| `PDF_EXTENSIONS` | `src/pdf/pdf.tsx:17` | PDF extension registration. |
| `findHits` | `src/pdf/pdf.tsx:75-96` | Locate case-folded search matches and map them to text-layer item spans on each page. |
| RPC `open` | `server.ts:69-74`; `server.ts:505-516` | Resolve the file and create a preview URL. |
| GET `/pdfjs/pdf.min.mjs` | `server.ts:363-370` | Serve the PDF.js library module. |
| GET `/pdfjs/pdf.worker.min.mjs` | `server.ts:363-370` | Serve the PDF.js worker module. |

## Package shape

`src/pdf/pdf.tsx` owns the opener, page rendering, zoom, search, selection, and download controls; `server.ts` hosts PDF.js static modules and the shared file preview RPC (`src/pdf/pdf.tsx:1-30`; `server.ts:360-370`).

## Internal model

The opener holds the PDF.js loading task, document, page sizes, rendered page state, current page, zoom and search state in React (`src/pdf/pdf.tsx:239-330`). It renders visible pages and maintains generation guards so stale asynchronous loads do not replace the current viewer (`src/pdf/pdf.tsx:299-330`).

## Dependencies

`pdfjs-dist` provides the parser/renderer and its legacy build files served by the plugin (`package.json`; `server.ts:360-370`).

## Gotchas

- The runtime and worker are loaded through separate server routes; failure to load either prevents PDF.js from rendering the document (`src/pdf/pdf.tsx:54-62`; `server.ts:363-370`).
- Text search and selection depend on a text layer in the document (`src/pdf/pdf.tsx:239-298`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer architecture](../architecture.md)
- [Office Viewer overview](../overview.md)
