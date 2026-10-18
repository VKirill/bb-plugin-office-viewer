---
title: Spreadsheet editing
type: component
created: 2026-10-13
updated: 2026-10-18
status: active
confidence: medium
tags: [spreadsheets, editing, formulas]
sources:
  - src/spreadsheet/opener.tsx
  - src/spreadsheet/sheet.ts
  - src/spreadsheet/engine.ts
  - src/spreadsheet/edits.ts
  - src/spreadsheet/formula.ts
  - src/spreadsheet/csv.ts
  - src/spreadsheet/xlsx-patch.ts
  - server.ts
  - app.tsx
  - src/spreadsheet/grid.tsx
  - src/spreadsheet/xlsx-patch.test.ts
  - src/spreadsheet/functions.ts
  - src/spreadsheet/formula-input.tsx
---

# Spreadsheet editing

TL;DR: The spreadsheet opener parses supported workbook files into a virtualized grid, calculates edits in IronCalc, then saves only changed cells for editable formats (`src/spreadsheet/opener.tsx:103-162`; `src/spreadsheet/engine.ts:55-113`).

## Purpose

Open spreadsheet files in BB, inspect/search/copy cells, quote a selected range into the chat, and edit the formats whose save path is implemented (`src/spreadsheet/sheet.ts:6-13`; `src/spreadsheet/opener.tsx:103-162`).

## How it works

1. BB routes extensions registered by `app.tsx` to `SpreadsheetOpener` (`app.tsx:5-7`; `app.tsx:19-25`).
2. The opener calls RPC `open`, fetches the preview URL, decodes its bytes, parses through `parseWorkbook`, and constructs the formula model (`src/spreadsheet/opener.tsx:103-162`; `src/spreadsheet/sheet.ts:155-176`; `src/spreadsheet/engine.ts:55-113`).
3. The grid renders visible cells and selection; formula and cell inputs are normalized into engine inputs, and dependent formulas recalculate in the model (`src/spreadsheet/grid.tsx:58-117`; `src/spreadsheet/engine.ts:139-182`).
   `FormulaInput` shows function completion for the token at the caret, cycles candidates with arrow keys, accepts with Tab or Enter, and dismisses with Escape (`src/spreadsheet/formula-input.tsx:28-100`). The catalog supplies English and Russian names, argument signatures and hints (`src/spreadsheet/functions.ts:1-67`).
4. Search traverses cells in row-major order; quote actions format the selected range as a Markdown table and insert it into the chat composer (`src/spreadsheet/sheet.ts:178-193`; `src/spreadsheet/edits.ts:97-142`; `src/spreadsheet/opener.tsx:103-162`).
5. Save serializes touched cells and sends edits with the original SHA-256. The server compares the current read hash before patching and supplies the expected hash to the final write (`src/spreadsheet/engine.ts:198-239`; `server.ts:548-569`).

| Mode | Inputs and behavior | Save result |
|---|---|---|
| `.xlsx`, `.xlsm` | SheetJS workbook; IronCalc formula model; workbook formatting metadata is used for cell display (`src/spreadsheet/sheet.ts:155-176`; `src/spreadsheet/engine.ts:55-113`). | Worksheet XML is patched for edited cells; server rejects unsupported edit modes (`src/spreadsheet/xlsx-patch.ts:246-278`; `server.ts:333-342`). |
| `.csv`, `.tsv` | One synthetic sheet named after the extension; delimited text is decoded as CSV/TSV (`src/spreadsheet/sheet.ts:155-172`; `src/spreadsheet/csv.ts:20-96`). | Edited text is serialized while preserving detected delimiter/encoding/newline details; formulas are saved as computed values (`src/spreadsheet/csv.ts:97-131`; `src/spreadsheet/engine.ts:198-209`). |
| `.xls`, `.xlsb`, `.ods` | Read through SheetJS (`src/spreadsheet/sheet.ts:6-8`; `src/spreadsheet/sheet.ts:173-176`). | Read-only; save mode is `null` (`src/spreadsheet/sheet.ts:9-13`). |

On parse, load, engine or save errors, the opener displays an error state; a hash conflict is returned as a conflict so the UI can offer reload/apply handling (`src/spreadsheet/opener.tsx:103-162`; `server.ts:548-569`). `applyEdits` delegates XLSX to `patchXlsx`, CSV to parsed edits and serialization, and throws `PatchError` for other extensions (`server.ts:333-342`). The save handler converts `PatchError` to a localized error (`server.ts:557-563`).

## Business rules

- Editable formats are exactly `.xlsx`, `.xlsm`, `.csv` and `.tsv`; `.xls`, `.xlsb` and `.ods` are view-only (`src/spreadsheet/sheet.ts:6-13`).
- Row and column coordinates are zero-based in edits, bounded to 1,048,575 and 16,383 respectively; each save contains 1–50,000 edits (`server.ts:60-67`; `server.ts:106-118`).
- Save compares the read file hash with `expectedSha256` before patching and passes that hash to the final write (`server.ts:548-569`).
- XLSX patching validates sheet index and name and refuses array formulas and cells without references (`src/spreadsheet/xlsx-patch.ts:246-278`; tests at `src/spreadsheet/xlsx-patch.test.ts:82-130`).
- Unsupported formulas display cached file text instead of the engine error (`src/spreadsheet/engine.ts:104-112`; `src/spreadsheet/engine.ts:118-132`).
- `initEngine` initializes the WASM module once per browser module instance; later calls return without reinitializing it (`src/spreadsheet/engine.ts:11-20`).
- For XLSX input, an empty cell edit clears, `=...` is a formula, English or Russian boolean words become booleans, valid dates in date cells become serial numbers, and numeric input accepts commas, spaces and a trailing percent sign. CSV input remains text (`src/spreadsheet/edits.ts:34-53`).
- Formula reference insertion formats single cells, ranges, whole rows or columns and quotes sheet names that are not valid bare identifiers (`src/spreadsheet/formula.ts:85-95`; `src/spreadsheet/formula.ts:97-102`).

## Public API

| Import or call | File | Purpose |
|---|---|---|
| `SpreadsheetOpener` | `src/spreadsheet/opener.tsx:103-162` | BB UI for opening, editing and quoting a workbook. |
| `parseWorkbook`, `findCells`, `editMode` | `src/spreadsheet/sheet.ts:9-13`; `src/spreadsheet/sheet.ts:155-193` | Parse workbook data, select save mode and search. |
| `buildWorkbook`, `applyInput`, `editsForSave` | `src/spreadsheet/engine.ts:55-113`; `src/spreadsheet/engine.ts:139-182`; `src/spreadsheet/engine.ts:198-239` | Build model, apply values and produce save edits. |
| `initEngine` | `src/spreadsheet/engine.ts:16-20` | Initialize IronCalc WASM once. |
| `FUNCTIONS` | `src/spreadsheet/functions.ts:8-67` | Formula autocomplete catalog with English and Russian names and argument hints. |
| `FormulaInput` | `src/spreadsheet/formula-input.tsx:28-87` | Formula editor and completion interaction. |
| `parseInput`, `referenceText` | `src/spreadsheet/edits.ts:35-53`; `src/spreadsheet/formula.ts:89-95` | Convert entered text to edit values and format selected references. |
| `parseCsv`, `serializeCsv`, `applyCsvEdits` | `src/spreadsheet/csv.ts:43-131` | CSV and TSV decoding, serialization and edits. |
| `patchXlsx` | `src/spreadsheet/xlsx-patch.ts:246-278` | Patch edited cells in an XLSX package. |
| `applyEdits` | `server.ts:333-342` | Dispatch edits to XLSX patching or CSV serialization; reject read-only extensions. |

## Package shape

`sheet.ts` and `csv.ts` parse files; `engine.ts`, `formula.ts`, `functions.ts` and `edits.ts` implement formula and input behavior; `grid.tsx` and `formula-input.tsx` provide editing UI; `xlsx-patch.ts` writes workbook changes; `opener.tsx` connects them to BB (`src/spreadsheet/opener.tsx:1-20`).

## Internal model

SheetJS supplies sheet and cell data; IronCalc owns the editable workbook state and recalculates formulas. The spreadsheet keeps parsed sheet metadata for display and change comparison, while `editsForSave` emits only touched cells that differ from the original (`src/spreadsheet/engine.ts:22-29`; `src/spreadsheet/engine.ts:198-239`).

## Dependencies

SheetJS parses workbook formats, IronCalc WASM computes formulas, and `fflate` enables XLSX package patching (`package.json`; `src/spreadsheet/engine.ts:4-6`; `src/spreadsheet/xlsx-patch.ts:1-5`). The server performs final writes through BB file services (`server.ts:548-569`).

## Gotchas

- Excel formatting is not a full style renderer; editing focuses on values and formula behavior (`src/spreadsheet/sheet.ts:67-104`; `src/spreadsheet/engine.ts:135-137`).
- CSV formulas are persisted as computed values, not formula strings (`src/spreadsheet/engine.ts:198-209`).
- Saving a formula unsupported by IronCalc can leave cached values on untouched cells until another spreadsheet engine recalculates them (`src/spreadsheet/engine.ts:104-132`; `src/spreadsheet/engine.ts:198-239`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer API](../api.md)
- [Office Viewer architecture](../architecture.md)
- [Office Viewer gotchas](../gotchas.md)
- [Office Viewer overview](../overview.md)
