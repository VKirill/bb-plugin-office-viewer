---
title: Office Viewer deployment
type: deployment
created: 2026-10-13
updated: 2026-10-18
status: active
confidence: medium
tags: [deployment, install, development]
sources:
  - package.json
  - tsconfig.json
  - app.tsx
  - server.ts
  - README.md
  - src/server/locate.ts
---

# Office Viewer deployment

TL;DR: Install Node dependencies, run the BB plugin build, and install the resulting project with the BB CLI; development scripts provide tests and typechecking (`package.json`; `README.md`).

## Prerequisites

- BB `>=0.43` and BB Plugin SDK `>=0.4.87` as package engine requirements (`package.json`).
- Node.js with npm for the package scripts and TypeScript (`package.json`; `tsconfig.json:1-23`).
- BB CLI (`bb`) for plugin build, installation and reload; scripts and install command are documented in `package.json` and `README.md`.

No environment variables are read by the plugin code. The server derives a typed SDK handle from `bb.sdk` and uses `bb.http` for route registration (`server.ts:356-382`; `src/server/locate.ts:22-36`).

## Deploy procedure

1. Install dependencies:

   ```sh
   npm install
   ```

2. Build the plugin:

   ```sh
   npm run build
   ```

   The build script runs `bb plugin build .` (`package.json`).

3. Install the plugin from the checkout:

   ```sh
   bb plugin install .
   ```

4. In BB Settings → File openers, select Office Viewer when another plugin claims the same extension; the existing README describes this UI selection (`README.md`).

## Verify

Run the repository checks before installation when validating a checkout:

```sh
npm test
npm run typecheck
```

`npm test` runs Node's test runner over `src/**/*.test.ts`; `typecheck` runs `tsc --noEmit` (`package.json`; `tsconfig.json:24-31`). The test suite covers spreadsheet parsing/patching/formulas, PPTX parsing and path resolution (`src/spreadsheet/engine.test.ts`; `src/slides/pptx.test.ts`; `src/server/locate.test.ts`).

## Rollback

Remove or disable the Office Viewer plugin in BB's plugin management interface. The repository does not define a CLI uninstall command or a release rollback script (`package.json`; `README.md`).

## Troubleshooting

- If the BB CLI rejects the project, check installed BB and SDK versions against `engines` (`package.json`).
- If a dependency install fails, `xlsx` is sourced from the SheetJS CDN tarball rather than the npm registry (`package.json`).
- If files cannot be opened, verify the BB source still resolves to an available host and that the path is in its permitted root (`src/server/locate.ts:58-68`; `src/server/locate.ts:91-133`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer overview](overview.md)
