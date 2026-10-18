---
title: Office Viewer — project facts
updated: 2026-10-18
sources:
  - package.json
  - app.tsx
  - server.ts
  - src/server/locate.ts
  - docs/architecture.md
  - docs/gotchas.md
  - docs/features/html-layout.md
  - src/studio/studio-panel.tsx
  - src/studio/tools.tsx
  - src/studio/prototype/builder.tsx
  - src/studio/slides/editor.tsx
  - src/studio/paint/paint.tsx
---

# Office Viewer — project facts

## Identity

- BB file opener plugin; package entry points: `app.tsx`, `server.ts` (`package.json`). [Overview](docs/overview.md)
- Architecture and service boundaries: [Architecture](docs/architecture.md).
- Recorded architectural rationale: [Decisions](docs/decisions.md).

## Entry points

- Six file opener registrations and plugin panels: `app.tsx:19-75`; opener implementations under `src/`. [Architecture](docs/architecture.md)
- Backend RPC, GET routes and file writes: `server.ts:356-933`. [API](docs/api.md)
- File source resolution: `src/server/locate.ts:91-133`.

## Critical invariants

- Resolve files using opener source context; workspace paths are constrained to root (`src/server/locate.ts:49-56`; `src/server/locate.ts:91-133`). [Gotchas](docs/gotchas.md)
- Spreadsheet save concurrency: [Spreadsheet editing](docs/features/spreadsheets.md) (`server.ts:548-569`).
- Studio prototype, slide and paint documents are separate thread-scoped files persisted through RPC to BB thread storage (`src/studio/prototype/builder.tsx:1270-1303`; `src/studio/slides/editor.tsx:96-125`; `src/studio/paint/paint.tsx:98-118`). [Studio](docs/features/studio.md)
- Opened formats and editable formats differ; read-only modes live in each feature page. [Feature reference](docs/features/office-documents.md)

## Conventions

- TypeScript ES modules; React JSX; `@/*` aliases map to project root (`tsconfig.json:1-23`).
- File openers and Studio tools call the typed BB RPC contract in `server.ts:69-321`.
- Feature behavior and limits: [Spreadsheets](docs/features/spreadsheets.md), [Office documents](docs/features/office-documents.md), [PDF](docs/features/pdf.md), [HTML layout](docs/features/html-layout.md), [Media](docs/features/media.md).
- Studio tool behavior: [Studio](docs/features/studio.md).

## Common gotchas

- File context selects host and root; no fallback to another machine (`src/server/locate.ts:91-133`). [Gotchas](docs/gotchas.md)
- Only `.xlsx`, `.xlsm`, `.csv` and `.tsv` are editable (`src/spreadsheet/sheet.ts:6-13`). [Spreadsheet editing](docs/features/spreadsheets.md)
- Other format-specific limitations: [Gotchas](docs/gotchas.md).

## Useful commands

- `npm install`
- `npm test`
- `npm run typecheck`
- `npm run build` (`package.json`)
- `bb plugin install .`

Detailed setup: [Deployment](docs/deployment.md).

## Where to look next

- [API](docs/api.md)
- [Data model](docs/data-model.md)
- [Deployment](docs/deployment.md)
