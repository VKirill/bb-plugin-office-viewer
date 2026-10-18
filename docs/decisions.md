---
title: Office Viewer decisions
type: decisions
created: 2026-10-13
updated: 2026-10-18
status: active
confidence: medium
tags: [decisions, pdf, architecture]
sources:
  - server.ts
  - src/pdf/pdf.tsx
  - app.tsx
---

# Office Viewer decisions

TL;DR: The repository history records PDF.js as a server-served asset so its library and worker do not inflate every frontend bundle (`504ac6c8c83e0269489aad4b1335986a9b87a910`).

## PDF.js is served by the plugin server

**Context:** Bundling PDF.js and its worker in the app raised the built app size from 0.9 MB to 2.7 MB, according to the implementation commit (`504ac6c8c83e0269489aad4b1335986a9b87a910`).

**Decision:** Serve `pdf.min.mjs` and `pdf.worker.min.mjs` from plugin HTTP routes and load PDF.js on demand from the PDF opener (`server.ts:360-370`; `src/pdf/pdf.tsx:54-62`).

**Status:** Active; the server registers both asset routes and uses the installed package version as the ETag (`server.ts:360-370`).

**Consequences:** PDF.js and its worker are fetched through the PDF viewer's asset routes rather than included in the app entry bundle; route availability is required to load PDF files (`server.ts:360-370`; `src/pdf/pdf.tsx:284-303`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer overview](overview.md)
