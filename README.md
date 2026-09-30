# Office Viewer for BB

Work with spreadsheets inside [BB](https://getbb.app) the way you do in Excel: open `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.ods`, `.csv` and `.tsv` files from chat links, the file picker and `bb thread open`, edit them with live formulas, and quote cells into the chat.

## Features

- **Sheet tabs** with hidden sheets marked.
- **Excel-like grid**: column letters and row numbers stay in place, the first row can be frozen, numbers are right-aligned, merged cells span their range.
- **Large sheets scroll smoothly**: only the visible cells are rendered.
- **Values as Excel shows them**: number and date formats come from the file; formulas show their cached result, and the formula itself appears in the cell bar.
- **Search** across the sheet with a match counter, Enter / Shift+Enter to step through matches.
- **Cell bar**: address, full value, formula, Copy, and Open for links (`https://…` text or cell hyperlinks).
- **Selection**: click and drag, Shift+click, Shift+arrows, click a column letter or row number, ⌘A.
- **Quote in chat**: right-click a selection → *Quote in chat* or *Comment in chat…* puts the file, sheet, range and the cells as a Markdown table into the thread composer, optionally with your note.
- **Live formulas**: the workbook runs in the [IronCalc](https://github.com/ironcalc/IronCalc) engine, so every edit recalculates dependent cells, including other sheets. SUM, AVERAGE, COUNTA, SUMIFS, COUNTIFS, VLOOKUP, XLOOKUP, INDEX/MATCH, IF/IFS, IFERROR, TEXT, dates, PMT and hundreds more are computed.
- **Formula entry like Excel**: type `=` and click or drag cells (or use the arrows) to insert references, click column letters or row numbers for whole columns/rows, switch sheets to reference them. References are colored in the editor and outlined on the grid. Function names complete as you type (English or Russian: `=впр` → `ВПР(`), and the signature of the function under the caret is shown. Russian names and `;` separators are converted automatically.
- **Formula bar** with the cell address; edit there or in the cell.
- **Editing** (`.xlsx`, `.xlsm`, `.csv`, `.tsv`): double-click, F2 or start typing; Enter / Tab commit, Esc cancels, Delete clears, ⌘Z / ⌘⇧Z undo and redo, ⌘S saves. Numbers, percentages, day-first dates and TRUE/FALSE are recognised.
- **Copy, cut and paste**: within the sheet references shift like Excel's; tab-separated text from other apps pastes into cells.
- **Fill handle**: drag the corner of a selection to continue series and copy formulas.
- **Status bar**: sum, average and count of the selection.
- **Formatting is preserved**: an `.xlsx` save rewrites only the edited cells inside the worksheet XML. Cell styles, conditional formatting, data validation, comments, charts, pivot tables and macros stay untouched; new number formats (a typed date, a percentage, a format inherited by a formula) are added as cell styles. Newer functions are written with Excel's `_xlfn.` prefix. CSV keeps its delimiter, quoting, line endings, BOM and encoding (UTF-8 or Windows-1251); formulas in CSV are saved as their values.
- **Safe saving**: a save is refused if the file changed on disk since it was opened; you choose to reload or apply your edits to the new version.
- **Keyboard**: arrows, Tab and Enter move the selection; Shift extends it; ⌘ + arrows jump to the edge of the data.
- **CSV and TSV**: separator detection (`,` `;` tab), UTF-8 or Windows-1251 text.
- **Machine-aware**: the file is read on the machine of the thread, environment or project it belongs to, so it works from any device you browse BB on.
- **Download** the original file.

### Images and videos

- Opens `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico` and `.mp4`, `.m4v`, `.webm`, `.mov`, `.ogv` from chat links, the file picker and `bb thread open`.
- **Download** saves the file to the device you are browsing BB on (⌘S / Ctrl+S).
- **Copy** puts an image on the system clipboard (⌘C / Ctrl+C) so you can paste it into another app.
- Videos play with seeking in every browser, Safari on iPhone and iPad included: the file is loaded into the page, because BB's preview links don't serve byte ranges. Videos over 512 MB stream from the link instead.

The interface follows BB's language (English or Russian).

## Install

```sh
bb plugin install <path-or-git-url>
```

If another plugin also opens one of these extensions, choose **Office Viewer** for it in BB Settings → File openers.

Requires BB 0.43 or later. No account, API key or external service. Files up to 30 MB.

## Limits

- The clipboard only holds still images: copying a GIF copies its first frame (use Download for the animation), and videos can't be copied, only downloaded.
- Whether a video plays depends on the browser's codecs (e.g. HEVC `.mov` doesn't play in Chrome); Download always works.
- `.xls`, `.xlsb` and `.ods` are read-only.
- Functions IronCalc doesn't know show the value saved in the file (in italics) and aren't recalculated in BB; Excel recalculates everything when it opens a saved file.
- Saved files keep the cached results of untouched formulas; readers that don't recalculate (e.g. scripts) may see old values until the file is opened in Excel.
- Numbers are displayed in English format (1,234.5): the engine has no Russian locale yet.
- Array formulas can't be edited; cells of a shared formula are rewritten as individual formulas when their source cell is replaced.
- Inserting or deleting rows and columns, sorting, filtering, cell formatting and Excel styles on screen are not available yet.
- Cell colors, fonts and borders from Excel are not rendered.
- Legacy `.xls` files in non-Unicode code pages may show garbled text.

## Development

```sh
npm install
npm test          # parsing, CSV round-trip, xlsx patching, formula helpers, engine, file location
npm run typecheck
bb plugin build .
bb plugin reload office-viewer
```

Spreadsheet parsing uses [SheetJS Community Edition](https://sheetjs.com) (Apache-2.0); formulas are computed by [IronCalc](https://github.com/ironcalc/IronCalc) (MIT/Apache-2.0); `.xlsx` packages are rewritten with [fflate](https://github.com/101arrowz/fflate) (MIT). `fixtures/styled.xlsx` is a formatted workbook used to check that saves keep styles, validation, comments and charts.

## License

MIT
