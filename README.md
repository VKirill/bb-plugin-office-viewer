# Office Viewer for BB

View and edit spreadsheets inside [BB](https://getbb.app): open `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.ods`, `.csv` and `.tsv` files from chat links, the file picker and `bb thread open`, select cells and quote them into the chat.

## Features

- **Sheet tabs** with hidden sheets marked.
- **Excel-like grid**: column letters and row numbers stay in place, the first row can be frozen, numbers are right-aligned, merged cells span their range.
- **Large sheets scroll smoothly**: only the visible cells are rendered.
- **Values as Excel shows them**: number and date formats come from the file; formulas show their cached result, and the formula itself appears in the cell bar.
- **Search** across the sheet with a match counter, Enter / Shift+Enter to step through matches.
- **Cell bar**: address, full value, formula, Copy, and Open for links (`https://…` text or cell hyperlinks).
- **Selection**: click and drag, Shift+click, Shift+arrows, click a column letter or row number, ⌘A.
- **Quote in chat**: right-click a selection → *Quote in chat* or *Comment in chat…* puts the file, sheet, range and the cells as a Markdown table into the thread composer, optionally with your note.
- **Editing** (`.xlsx`, `.xlsm`, `.csv`, `.tsv`): double-click, F2 or start typing; Enter / Tab commit, Esc cancels, Delete clears the selection, ⌘Z undoes, ⌘S saves. Numbers, percentages, day-first dates, TRUE/FALSE and `=formulas` are recognised.
- **Formatting is preserved**: an `.xlsx` save rewrites only the edited cells inside the worksheet XML. Cell styles, conditional formatting, data validation, comments, charts, pivot tables and macros stay untouched; Excel recalculates formulas when it opens the file, and formulas that depend on edited cells are shown in italics until then. CSV keeps its delimiter, quoting, line endings, BOM and encoding (UTF-8 or Windows-1251).
- **Safe saving**: a save is refused if the file changed on disk since it was opened; you choose to reload or apply your edits to the new version.
- **Keyboard**: arrows, Tab and Enter move the selection; ⌘C / Ctrl+C copies the selection as tab-separated text.
- **CSV and TSV**: separator detection (`,` `;` tab), UTF-8 or Windows-1251 text.
- **Machine-aware**: the file is read on the machine of the thread, environment or project it belongs to, so it works from any device you browse BB on.
- **Download** the original file.

The interface follows BB's language (English or Russian).

## Install

```sh
bb plugin install <path-or-git-url>
```

If another plugin also opens one of these extensions, choose **Office Viewer** for it in BB Settings → File openers.

Requires BB 0.43 or later. No account, API key or external service. Files up to 30 MB.

## Limits

- `.xls`, `.xlsb` and `.ods` are read-only.
- Formulas are not recalculated in BB; the value saved in the file is shown, and edited dependencies are marked until Excel recalculates.
- Array formulas can't be edited; cells of a shared formula are rewritten as individual formulas when their source cell is replaced.
- Cell colors, fonts and borders from Excel are not rendered.
- Legacy `.xls` files in non-Unicode code pages may show garbled text.

## Development

```sh
npm install
npm test          # parsing, CSV round-trip, xlsx patching, editing model, file location
npm run typecheck
bb plugin build .
bb plugin reload office-viewer
```

Spreadsheet parsing uses [SheetJS Community Edition](https://sheetjs.com) (Apache-2.0); `.xlsx` packages are rewritten with [fflate](https://github.com/101arrowz/fflate) (MIT). `fixtures/styled.xlsx` is a formatted workbook used to check that saves keep styles, validation, comments and charts.

## License

MIT
