---
title: Office Viewer gotchas
type: gotchas
created: 2026-10-13
updated: 2026-10-17
status: active
confidence: low
tags: [gotchas, limitations, file-handling]
sources:
  - src/server/locate.ts
  - server.ts
  - src/spreadsheet/sheet.ts
  - src/spreadsheet/engine.ts
  - src/spreadsheet/xlsx-patch.ts
  - src/media/media.tsx
  - src/media/chat-image-editor.tsx
  - src/slides/slides.tsx
  - src/word/document.tsx
  - app.tsx
  - src/spreadsheet/opener.tsx
---

# Office Viewer gotchas

TL;DR: The sharp edges come from file ownership context, format-specific edit paths and browser media/document support (`src/server/locate.ts:91-133`; `src/spreadsheet/sheet.ts:6-13`).

## Critical

### File source context determines the machine

**Problem:** A path is resolved against its thread, environment, project or host context; missing context raises a `LocateError` (`src/server/locate.ts:91-133`).
**Risk:** A file path that exists on a different machine is not silently found there.
**Workaround:** Pass the opener's BB `source` fields intact (`src/media/media.tsx:57-70`).

### Spreadsheet save can conflict with a concurrent edit

**Problem:** The server checks the opened SHA-256 before patching and also passes it into the write (`server.ts:210-231`).
**Risk:** If another writer changes the file, the plugin returns `conflict` rather than replacing the newer version.
**Workaround:** The spreadsheet UI offers a reload path that discards local edits and an overwrite path that reapplies edits to the latest content (`src/spreadsheet/opener.tsx:103-162`; `server.ts:240-264`).

## High

### Spreadsheet viewer support does not imply edit support

**Problem:** Opening a spreadsheet does not imply its save path is enabled (`src/spreadsheet/sheet.ts:6-13`).
**Risk:** The UI cannot persist edits to every format it opens.
**Workaround:** Use the format matrix in [Spreadsheet editing](features/spreadsheets.md#how-it-works).

### Oversized files are gated by feature-specific paths

**Problem:** Size handling is implemented in several viewer paths rather than one shared gate (`server.ts:149-153`; `src/media/media.tsx:35-36`; `src/slides/slides.tsx:130-135`).
**Risk:** One global file-size rule does not describe all viewers.
**Workaround:** Consult [Media tools](features/media.md), [Office documents](features/office-documents.md) and [API](api.md) for the owner of each limit.

## Medium

### Large videos/audio bypass local blob decoding

**Problem:** Files with a known content length over 512 MiB cancel the response body and use the preview URL directly (`src/media/media.tsx:103-114`).
**Risk:** Browser codec and preview link behavior affect playback; this branch cannot use blob-only image/editor operations.
**Workaround:** Keep media editing scoped to image blobs and use download when the browser cannot play a stream (`src/media/media.tsx:154-168`).

### Experimental chat image editor requires an optional slot

**Problem:** The app registers the slot only when `experimental_vkImageEditor` exists (`app.tsx:45-51`).
**Risk:** BB image-preview editing is unavailable without that optional function.
**Workaround:** Open the image through the regular file opener to use its editor; the Browser image-preview slot only provides an editor when BB exposes that optional slot (`app.tsx:45-51`; `src/media/media.tsx:161-168`).

### Presentation parsing has explicit legacy behavior

**Problem:** Legacy binary presentations follow a download-only branch (`src/slides/slides.tsx:19-22`; `src/slides/slides.tsx:120-149`).
**Risk:** They do not render in the slide canvas.
**Workaround:** Follow the format behavior in [Office documents](features/office-documents.md#how-it-works).

## Low

### Unrecognized formula results can be cached text

**Problem:** When IronCalc reports selected unsupported formula errors, the workbook restores the original cached string for display (`src/spreadsheet/engine.ts:104-132`).
**Risk:** Displayed values can be stale until another spreadsheet engine recalculates the workbook.
**Workaround:** Verify unsupported formulas in a compatible spreadsheet application (`src/spreadsheet/engine.ts:104-132`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer overview](overview.md)
