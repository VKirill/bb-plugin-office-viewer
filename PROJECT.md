---
title: Office Viewer — project facts
updated: 2026-10-13
sources:
  - package.json
  - app.tsx
  - server.ts
  - src/server/locate.ts
  - docs/architecture.md
  - docs/gotchas.md
---

# Office Viewer — project facts

## Identity

- BB file opener plugin; package entry points: `app.tsx`, `server.ts` (`package.json`). [Overview](docs/overview.md)
- Architecture and service boundaries: [Architecture](docs/architecture.md).
- Recorded architectural rationale: [Decisions](docs/decisions.md).

## Entry points

- Frontend slot registration: `app.tsx`; opener implementations under `src/` (`app.tsx:14-52`). [Feature pages](docs/features/spreadsheets.md)
- Backend RPC, GET routes and file writes: `server.ts:114-233`. [API](docs/api.md)
- File source resolution: `src/server/locate.ts:91-133`.

## Critical invariants

- Resolve files using opener source context; workspace paths are constrained to root (`src/server/locate.ts:49-56`; `src/server/locate.ts:91-133`). [Gotchas](docs/gotchas.md)
- Spreadsheet save is conditional on the opened SHA-256 (`server.ts:210-231`). [Spreadsheet editing](docs/features/spreadsheets.md)
- Opened formats and editable formats differ; read-only modes live in each feature page. [Feature reference](docs/features/office-documents.md)

## Conventions

- TypeScript ES modules; React JSX; `@/*` aliases map to project root (`tsconfig.json:1-23`).
- Each UI opener calls the typed BB RPC client; backend contract schemas live in `server.ts:18-79`.
- Feature behavior and limits: [Spreadsheets](docs/features/spreadsheets.md), [Office documents](docs/features/office-documents.md), [PDF](docs/features/pdf.md), [Media](docs/features/media.md).

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
