---
title: Office Viewer architecture
type: architecture
created: 2026-10-13
updated: 2026-10-17
status: active
confidence: low
tags: [office-viewer, architecture, bb-plugin]
sources:
  - app.tsx
  - server.ts
  - src/server/locate.ts
  - src/spreadsheet/opener.tsx
  - src/media/media.tsx
  - src/word/document.tsx
  - src/slides/slides.tsx
  - src/pdf/pdf.tsx
  - src/spreadsheet/engine.ts
  - src/spreadsheet/xlsx-patch.ts
  - src/html/html.tsx
  - src/html/capture.ts
---

# Office Viewer architecture

TL;DR: BB hosts a React plugin app and a plugin server; registered file openers call server RPC to resolve/read/write files on the machine that owns them (`app.tsx:14-52`; `server.ts:125-126`; `server.ts:154-178`).

## System Context

```mermaid
C4Context
  Person(user, "BB user", "Opens and works with files")
  System(bb, "BB", "Dispatches files and hosts the plugin")
  System_Ext(hosts, "BB file hosts", "Own files and previews")
  System(plugin, "Office Viewer", "File openers and file operations")
  Rel(user, bb, "Selects or opens a file")
  Rel(bb, plugin, "Loads app slots and RPC")
  Rel(plugin, hosts, "Reads previews and writes edits")
```

## Containers

```mermaid
C4Container
  Person(user, "BB user", "Opens files")
  System_Boundary(plugin, "Office Viewer plugin") {
    Container(app, "React app", "TypeScript, React", "File opener UI and parsers")
    Container(server, "Plugin server", "BB Plugin SDK", "RPC, asset routes, file resolution")
  }
  System_Ext(bb, "BB host", "Plugin slots, RPC transport, composer")
  System_Ext(files, "BB file services", "Host files, previews, writes")
  Rel(user, bb, "Opens file")
  Rel(bb, app, "Renders selected opener")
  Rel(app, server, "RPC calls")
  Rel(server, files, "Reads, previews, writes")
```

The UI registers five file opener slots and an optional experimental image-editor slot (`app.tsx:14-52`). The server registers GET routes for PDF.js and screenshot assets plus one typed RPC contract (`server.ts:129-153`; `server.ts:154-178`).

## Building Blocks

- Spreadsheet parsing, engine, grid, formulas and save UI: [Spreadsheet editing](features/spreadsheets.md) (`src/spreadsheet/opener.tsx:103-162`; `src/spreadsheet/engine.ts:55-113`).
- Image, video and audio openers: [Media tools](features/media.md) (`src/media/media.tsx:52-111`).
- Word and PowerPoint viewers: [Office documents](features/office-documents.md) (`src/word/document.tsx:82-141`; `src/slides/slides.tsx:83-149`).
- PDF viewer: [PDF](features/pdf.md) (`src/pdf/pdf.tsx:239-298`).
- Server location policy: `src/server/locate.ts:91-133`; RPC handlers: `server.ts:132-234`.

## Key Flows

### Open a supported file

```mermaid
sequenceDiagram
  participant BB as BB app
  participant UI as File opener
  participant RPC as Plugin server
  participant Host as Owning file host
  BB->>UI: dispatch path and source
  UI->>RPC: open(source, path)
  RPC->>Host: resolve, check and create preview
  Host-->>RPC: preview URL
  RPC-->>UI: URL and resolved path
  UI->>Host: fetch file bytes
```

App slot registration passes the opener `path` and `source`, and the server's `open` handler locates the file and requests a preview (`app.tsx:14-44`; `server.ts:167-177`).

### Save spreadsheet edits

```mermaid
sequenceDiagram
  participant UI as Spreadsheet opener
  participant Engine as IronCalc model
  participant RPC as Plugin server
  participant Host as Owning file host
  UI->>Engine: apply typed input
  Engine-->>UI: calculated workbook state
  UI->>RPC: save(expectedSha256, sheet, edits)
  RPC->>Host: read current file
  RPC->>RPC: patch XLSX or serialize CSV
  RPC->>Host: conditional write
  Host-->>UI: written or conflict
```

The client translates touched cells to edits; server save checks the source hash before patching and passes the expected hash to the file write (`src/spreadsheet/engine.ts:198-239`; `server.ts:210-234`).

## Invariants

- Workspace-relative paths are lexically confined to their resolved root by `within`; host sources require absolute paths (`src/server/locate.ts:49-56`; `src/server/locate.ts:117-133`).
- The file host is selected from the opener's thread, environment, project or explicit host context; location failures are surfaced instead of silently choosing another computer (`src/server/locate.ts:91-133`).
- Spreadsheet saves compare the read file's SHA-256 with `expectedSha256`; a mismatch returns `conflict` without writing (`server.ts:210-218`).
- Spreadsheet edit schemas cap edits at 50,000 and constrain row/column coordinates to spreadsheet bounds (`server.ts:30-37`; `server.ts:66-77`).

## Cross-cutting concerns

Authentication is delegated to BB's plugin RPC and HTTP host; `server.ts` contains no user identity check in the registered handlers (`server.ts:114-132`). File access is through `bb.sdk.files`, `bb.sdk.hosts`, threads, environments and projects (`src/server/locate.ts:22-36`; `server.ts:142-210`). Errors from file reads/previews/writes are converted to path/host-aware messages for missing or unavailable machines (`server.ts:102-112`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer overview](overview.md)
