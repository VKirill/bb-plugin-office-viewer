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

### Word documents

- Opens `.docx`, `.docm`, `.dotx` as pages laid out like Word ([docx-preview](https://github.com/VolodymyrBaydalka/docxjs)): styles, tables, lists, pictures, headers, footers and footnotes. Pages shrink to the panel width, so a whole page fits on a phone.
- Opens the legacy `.doc` / `.dot` as text (body, headers and footers, footnotes), extracted on the server by [word-extractor](https://github.com/morungos/node-word-extractor).
- **Download** saves the original file (⌘S / Ctrl+S); text can be selected and copied.
- **Search** in the document (⌘F / Ctrl+F): hits are highlighted, Enter / Shift+Enter step through them, with an "i of n" counter. Words split across formatting are found too.
- **Zoom**: − / + buttons or ⌘ + / ⌘ − (Ctrl on Windows and Linux), click the percentage to fit the panel width, ⌘0 to reset.
- **Quote in chat**: select text, then use the header button or right-click → *Quote in chat*; the file and the text go into the composer as a Markdown blockquote.

### PowerPoint presentations

- Opens `.pptx`, `.ppsx` and `.potx`: a slide list on the left (below the slide on a phone), the current slide fitted to the panel, `←` / `→` / PageUp / PageDown / Home / End to move, and a `3 / 12` counter.
- **Present** shows the slides full screen (Fullscreen API) with the same keys plus Space and click; Esc leaves.
- **Speaker notes** appear under the slide when the deck has any.
- **Quote in chat** puts the current slide's title and text (bullets, tables) into the composer as a blockquote with the file and slide number.
- Slides are drawn from the file's own XML, without extra libraries: theme colors and fonts, layouts and masters, text with bullets and numbering, pictures (cropped, rounded), tables with their styles, groups, rotation, gradients and about thirty preset shapes plus freeform paths.
- The old binary `.ppt` isn't shown: the viewer says so and offers **Download**.

### PDF

- Opens `.pdf` files as one continuous scroll of pages ([PDF.js](https://mozilla.github.io/pdf.js/)); only the pages near the screen are drawn, sharp on HiDPI screens.
- **Zoom**: fit width (default), fit page, − / + buttons, ⌘/Ctrl + `+` `-` `0`; the percentage is shown. **Page** box shows the current page and jumps to the one you type.
- **Search** (⌘/Ctrl+F): matches are highlighted, Enter / Shift+Enter step through them, "3 of 12" counter.
- **Select and copy** text; **Quote in chat** puts the selected text into the composer as a Markdown blockquote with the file and page.
- **Download** (⌘/Ctrl+S). Password-protected PDFs ask for the password.

### Images, videos and audio

- Opens `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`, `.svg` and `.mp4`, `.m4v`, `.webm`, `.mov`, `.ogv` from chat links, the file picker and `bb thread open`.
- Images fit the panel on a checkerboard (transparency shows) with the pixel size; zoom with pinch, ⌘/Ctrl+wheel, ⌘+/−/0 or a double-click, drag to pan. ← → or the side arrows step through the other images of the folder.
- **Edit** (E) opens the image editor: rectangle (R), ellipse (O), arrow (A), line (L), pen (P), highlighter (M), text (T), numbered steps (N), blur (B), crop (C), select and move (V); eight colours (1–8), three widths, fill (tinted shapes, text on a label), Shift for squares and 45° lines, rotate and flip, undo/redo (⌘Z / ⇧⌘Z), arrow keys nudge the selection.
- The editor saves **a copy** next to the original or **overwrites** it (PNG, JPEG or WebP, with quality and 100/75/50/25 % size), downloads the result, copies it (⌘C), or sends it **to the chat**: a copy is saved, its path goes into the message and the image is also put on the clipboard, so ⌘V attaches it.
- Videos fit the panel in a 16:9 frame; speed 0.25×–3×, repeat, one-frame steps (, .), ← → 5 s, Space, F for full screen, picture in picture, and **Frame** opens the current frame in the editor.
- Audio: `.mp3`, `.wav`, `.ogg`, `.oga`, `.opus` (Telegram voice messages), `.m4a`, `.aac`, `.flac`, `.weba` open in a player: a waveform you click or drag to seek, play/pause (Space), stop, ±10 s (← → move 5 s), repeat, volume and speed 0.5×–2× (pitch kept; the speed is remembered). Recordings longer than 10 minutes get a progress bar instead of a waveform.
- **Download** saves the file to the device you are browsing BB on (⌘S / Ctrl+S).
- **Copy** puts an image on the system clipboard (⌘C / Ctrl+C) so you can paste it into another app.
- Videos play with seeking in every browser, Safari on iPhone and iPad included: the file is loaded into the page, because BB's preview links don't serve byte ranges. Videos over 512 MB stream from the link instead.

The interface is Russian when BB's language or the browser's first language is Russian, English otherwise.

## Install

```sh
bb plugin install <path-or-git-url>
```

If another plugin also opens one of these extensions, choose **Office Viewer** for it in BB Settings → File openers.

Requires BB 0.43 or later. No account, API key or external service. Files up to 30 MB.

## Limits

- PowerPoint slides are read-only and approximate PowerPoint's layout: charts, SmartArt and other embedded objects appear as labelled placeholders, and shadows, 3-D effects, animations, transitions and video are not shown. Fonts missing on the device are replaced, so line breaks may differ. `.ppt` is not supported.
- PDFs are read-only. Scanned pages without a text layer can be viewed but not searched or selected; JPEG 2000 images and fonts that are not embedded in the file may render with substitutes.
- Word documents are read-only. `.docx` layout is close to Word but not identical (fonts, floating shapes, charts and SmartArt may differ). Legacy `.doc` shows text only: no formatting, tables become tab-separated lines, pictures are skipped.
- The clipboard only holds still images: copying a GIF copies its first frame (use Download for the animation), and videos can't be copied, only downloaded.
- Safari before 18.4 doesn't play Ogg/Opus voice messages; Download always works.
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

Spreadsheet parsing uses [SheetJS Community Edition](https://sheetjs.com) (Apache-2.0); formulas are computed by [IronCalc](https://github.com/ironcalc/IronCalc) (MIT/Apache-2.0); `.xlsx` packages are rewritten with [fflate](https://github.com/101arrowz/fflate) (MIT); Word files are shown with docx-preview (Apache-2.0) and word-extractor (MIT), PDFs with PDF.js (Apache-2.0). `fixtures/styled.xlsx` is a formatted workbook used to check that saves keep styles, validation, comments and charts.

## License

MIT
