---
title: Office Viewer overview
type: overview
created: 2026-10-13
updated: 2026-10-18
status: active
confidence: medium
tags: [office-viewer, bb-plugin, overview]
sources:
  - package.json
  - app.tsx
  - server.ts
  - src/spreadsheet/sheet.ts
  - src/media/media.tsx
  - src/word/document.tsx
  - src/slides/slides.tsx
  - src/pdf/pdf.tsx
  - src/server/locate.ts
  - src/spreadsheet/engine.ts
  - src/studio/studio-panel.tsx
  - src/studio/tools.tsx
  - src/studio/prototype/builder.tsx
  - src/studio/slides/editor.tsx
  - src/studio/paint/paint.tsx
---

# Office Viewer overview

TL;DR: Office Viewer is a BB plugin with file viewers and thread tools for prototypes, slides, and paint; spreadsheet edits and several viewers integrate with chat (`package.json`; `app.tsx:19-75`; `src/studio/tools.tsx:7-27`).

## What it is

BB dispatches files to six registered openers by extension: spreadsheets, media, Word, PowerPoint, PDF and HTML layout (`app.tsx:19-55`). It also exposes a thread Studio panel for prototype building, slide authoring and paint; optional host slots add a thread-header action, browser toolbar action and chat image editor (`app.tsx:56-75`; `src/studio/studio-panel.tsx:12-14`; `src/studio/tools.tsx:7-27`). The server resolves file paths to their owning machine and supplies previews, extraction, writes, Studio persistence and published prototype previews (`server.ts:462-570`; `server.ts:718-765`; `src/server/locate.ts:91-133`).

The spreadsheet viewer supports `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.ods`, `.csv` and `.tsv`; only `.xlsx`, `.xlsm`, `.csv` and `.tsv` are editable (`src/spreadsheet/sheet.ts:6-13`). Word supports `.docx`, `.docm`, `.dotx`, `.doc` and `.dot`; PowerPoint rendering supports `.pptx`, `.ppsx` and `.potx`; PDF opens `.pdf` (`src/word/document.tsx:21-22`; `src/slides/slides.tsx:19-22`; `src/pdf/pdf.tsx:27-30`). Media extension handling is documented in [Media tools](features/media.md).

## Stack

- TypeScript and React, with BB Plugin SDK app slots and RPC (`package.json`; `app.tsx:3-14`; `server.ts:3-4`).
- Spreadsheet parsing uses SheetJS, formulas use IronCalc WebAssembly, and `.xlsx` patching uses `fflate` (`package.json`; `src/spreadsheet/engine.ts:4-6`; `server.ts:10-12`).
- Word rendering/extraction uses `docx-preview` and `word-extractor`; PDF rendering uses `pdfjs-dist` (`package.json`; `src/word/document.tsx:8`; `server.ts:6`; `src/pdf/pdf.tsx:1-5`).
- Studio stores thread-scoped prototypes, slide decks and paint documents through server RPC (`src/studio/prototype/builder.tsx:1270-1303`; `src/studio/slides/editor.tsx:96-125`; `src/studio/paint/paint.tsx:98-118`).
- Build, typecheck and test scripts are declared in `package.json`.

## Quick start

From the project root, install dependencies, build, and install the plugin in BB:

```sh
npm install
npm run typecheck
npm run build
bb plugin install .
```

The package declares BB `>=0.43` and SDK `>=0.4.87` in its `engines` field (`package.json`). See [Deployment](deployment.md) for development and reload steps.

## Where to look next

- [Architecture](architecture.md) explains the UI, RPC and file ownership boundaries.
- [Decisions](decisions.md) records the PDF.js asset-loading choice found in project history.
- [API](api.md) lists the server routes and RPC calls.
- [Data model](data-model.md) describes the source files and in-memory state the plugin reads and writes.
- [Spreadsheet editing](features/spreadsheets.md), [Word and PowerPoint](features/office-documents.md), [PDF](features/pdf.md), and [Media tools](features/media.md) describe user-facing behavior.
- [Studio](features/studio.md) describes prototype, slide-authoring and paint tools.
- [Gotchas](gotchas.md) records code-backed edge cases.
