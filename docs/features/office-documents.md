---
title: Word and PowerPoint documents
type: component
created: 2026-10-13
updated: 2026-10-13
status: active
confidence: medium
tags: [word, powerpoint, documents]
sources:
  - src/word/document.tsx
  - src/slides/slides.tsx
  - src/slides/pptx.ts
  - src/slides/slide-view.tsx
  - src/shared/quote.ts
  - server.ts
  - app.tsx
---

# Word and PowerPoint documents

TL;DR: This feature renders supported Word documents and PowerPoint presentations in BB, with search, zoom and chat quoting; legacy binary Word files are extracted as text (`src/word/document.tsx:82-170`; `src/slides/slides.tsx:83-149`).

## Purpose

The Word opener presents Word documents as pages or extracted legacy text; the slide opener parses Open XML presentations and draws slides in the browser (`src/word/document.tsx:148-170`; `src/slides/pptx.ts:401-460`; `src/slides/slide-view.tsx:140-159`).

## How it works

1. BB registers separate Word and slide openers for their extension lists (`app.tsx:27-37`).
2. For `.docx`, `.docm` and `.dotx`, the Word opener gets a preview URL, fetches file bytes and passes them to `docx-preview`; `.doc` and `.dot` call `docText` and render extracted sections (`src/word/document.tsx:21-22`; `src/word/document.tsx:148-170`; `server.ts:142-165`).
3. Word search finds case-insensitive text runs across formatted text nodes and highlights them; selected text is formatted with file context and inserted into the composer (`src/word/document.tsx:28-79`; `src/shared/quote.ts:3-10`).
4. The slide opener gets a preview, checks the payload size, parses the PPTX ZIP/XML into a deck and renders the selected slide; thumbnails, navigation, notes and present mode are managed by the opener (`src/slides/slides.tsx:83-160`; `src/slides/pptx.ts:401-460`; `src/slides/slide-view.tsx:140-159`).
5. A quote action converts the current slide's text to Markdown with file and slide context before inserting it into the composer (`src/slides/pptx.ts:481-498`; `src/slides/slides.tsx:83-149`).

| Mode | Inputs and output | Failure behavior |
|---|---|---|
| Word Open XML (`.docx`, `.docm`, `.dotx`) | Browser fetch + `docx-preview` page layout; search, zoom, selection, download and quoting (`src/word/document.tsx:21-22`; `src/word/document.tsx:160-170`). | Fetch or render errors set the opener error state (`src/word/document.tsx:148-170`). |
| Legacy Word (`.doc`, `.dot`) | Server `word-extractor` returns body, headers, footnotes and endnotes; UI shows plain text (`server.ts:142-165`; `src/word/document.tsx:148-158`). | Extraction errors are wrapped in localized messages; inputs over 30 MiB are rejected (`server.ts:149-153`). |
| PowerPoint Open XML (`.pptx`, `.ppsx`, `.potx`) | Browser parses slide XML into shapes, text, images and tables (`src/slides/slides.tsx:19-22`; `src/slides/pptx.ts:401-460`). | Invalid presentation and fetch errors enter the error state; input over 30 MiB is rejected (`src/slides/slides.tsx:120-149`). |
| Legacy PowerPoint (`.ppt`, `.pps`, `.pot`) | Viewer displays a download-only message (`src/slides/slides.tsx:20-22`; `src/slides/slides.tsx:120-149`). | No binary parser is called. |

## Business rules

- Word and PowerPoint viewers are read-only; the UI offers original download and chat quote actions (`src/word/document.tsx:148-170`; `src/slides/slides.tsx:120-149`).
- Word quote content includes selected text and source context through `formatBlockquote` (`src/shared/quote.ts:3-10`). Slide quotes include slide text and numbering (`src/slides/pptx.ts:481-498`).
- Legacy Word extraction preserves Unicode punctuation by passing `filterUnicode: false` (`server.ts:154-165`).
- PowerPoint parsing is for Open XML extensions only; legacy binary files are not parsed (`src/slides/slides.tsx:19-22`).

## Public API

| Import or call | File | Purpose |
|---|---|---|
| `DocumentOpener` | `src/word/document.tsx:82-170` | Word open, search, zoom and quote UI. |
| `WORD_EXTENSIONS` | `src/word/document.tsx:21-22` | Word extension registration. |
| `SlidesOpener` | `src/slides/slides.tsx:83-160` | PowerPoint navigation and presentation UI. |
| `parsePptx`, `slideMarkdown` | `src/slides/pptx.ts:401-498` | Parse a presentation and extract slide quote text. |
| `SlideView`, `ScaledSlide` | `src/slides/slide-view.tsx:140-159` | Draw a slide at native or scaled width. |
| RPC `docText` | `server.ts:45-50`; `server.ts:142-165` | Extract text from legacy Word files. |

## Package shape

`src/word/` renders Word documents and search; `src/slides/` parses XML, models presentation structures and renders slides (`src/word/document.tsx:1-4`; `src/slides/slides.tsx:1-3`). Both use shared localization, formatting and quote helpers (`src/shared/quote.ts:3-10`).

## Internal model

The Word UI retains extracted legacy sections or renders fetched Open XML pages in the DOM. The slide parser builds a `Deck` and `Slide` model from package XML; the view maps model shapes and text to React/SVG (`src/word/document.tsx:39-40`; `src/slides/pptx.ts:14-48`; `src/slides/slide-view.tsx:23-124`).

## Dependencies

Word rendering uses `docx-preview`, legacy extraction uses `word-extractor`; slide parsing is implemented in project code with `fflate` for package access (`package.json`; `src/word/document.tsx:8`; `server.ts:6`; `src/slides/pptx.ts:1-12`).

## Gotchas

- Unsupported presentation objects are represented by parser/viewer fallbacks; this renderer does not reproduce all PowerPoint effects (`src/slides/pptx.ts:401-460`; `src/slides/slide-view.tsx:65-124`).
- Legacy `.doc` text extraction is not page layout and does not preserve document formatting (`server.ts:142-165`; `src/word/document.tsx:148-158`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer architecture](../architecture.md)
- [Office Viewer gotchas](../gotchas.md)
- [Office Viewer overview](../overview.md)
