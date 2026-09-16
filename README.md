# Office Viewer for BB

View spreadsheets inside [BB](https://getbb.app): open `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.ods`, `.csv` and `.tsv` files from chat links, the file picker and `bb thread open` as a read-only grid.

## Features

- **Sheet tabs** with hidden sheets marked.
- **Excel-like grid**: column letters and row numbers stay in place, the first row can be frozen, numbers are right-aligned, merged cells span their range.
- **Large sheets scroll smoothly**: only the visible cells are rendered.
- **Values as Excel shows them**: number and date formats come from the file; formulas show their cached result, and the formula itself appears in the cell bar.
- **Search** across the sheet with a match counter, Enter / Shift+Enter to step through matches.
- **Cell bar**: address, full value, formula, Copy, and Open for links (`https://…` text or cell hyperlinks).
- **Keyboard**: arrows, Tab and Enter move the selection; ⌘C / Ctrl+C copies the value.
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

- Read-only: no editing or saving.
- Formulas are not recalculated; the value saved in the file is shown.
- Cell colors, fonts and borders from Excel are not rendered.
- Legacy `.xls` files in non-Unicode code pages may show garbled text.

## Development

```sh
npm install
npm test          # parsing, CSV, search, file location
npm run typecheck
bb plugin build .
bb plugin reload office-viewer
```

Spreadsheet parsing uses [SheetJS Community Edition](https://sheetjs.com) (Apache-2.0).

## License

MIT
