---
title: Office Viewer overview
type: overview
created: 2026-10-13
updated: 2026-10-13
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
---

# Office Viewer overview

TL;DR: Office Viewer is a BB plugin that opens office documents and media in BB, with editable spreadsheet formats and chat quoting across several viewers (`package.json`; `app.tsx:14-52`).

## What it is

BB dispatches files to the plugin's registered openers by extension. The frontend has separate openers for spreadsheets, media, Word, PowerPoint and PDF, plus an experimental image editor slot when BB exposes it (`app.tsx:14-52`). The server resolves file paths to the machine and location represented by the opener source, then supplies previews, extracted legacy Word text, spreadsheet saves and edited-image writes (`server.ts:132-210`; `src/server/locate.ts:91-133`).

The spreadsheet viewer supports `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.ods`, `.csv` and `.tsv`; only `.xlsx`, `.xlsm`, `.csv` and `.tsv` are editable (`src/spreadsheet/sheet.ts:6-13`). Word supports `.docx`, `.docm`, `.dotx`, `.doc` and `.dot`; PowerPoint rendering supports `.pptx`, `.ppsx` and `.potx`; PDF opens `.pdf` (`src/word/document.tsx:21-22`; `src/slides/slides.tsx:19-22`; `src/pdf/pdf.tsx:27-30`). Media extension handling is documented in [Media tools](features/media.md).

## Stack

- TypeScript and React, with BB Plugin SDK app slots and RPC (`package.json`; `app.tsx:3-14`; `server.ts:3-4`).
- Spreadsheet parsing uses SheetJS, formulas use IronCalc WebAssembly, and `.xlsx` patching uses `fflate` (`package.json`; `src/spreadsheet/engine.ts:4-6`; `server.ts:10-12`).
- Word rendering/extraction uses `docx-preview` and `word-extractor`; PDF rendering uses `pdfjs-dist` (`package.json`; `src/word/document.tsx:8`; `server.ts:6`; `src/pdf/pdf.tsx:1-5`).
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
- [Gotchas](gotchas.md) records code-backed edge cases.
