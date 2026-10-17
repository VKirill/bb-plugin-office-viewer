# Revert spreadsheet link chips, release 0.8.7

The owner wants spreadsheet link cells to look exactly as before 0.8.6 (sky-blue underlined text). Revert the display change of tasks sheet-link-chips and sheet-link-chips-fix (commits dd40e93 and the sheet-link-chips-fix merge 549a70c):

1. src/spreadsheet/grid.tsx: restore the renderCell markup and classes from before dd40e93 (`git show 29a188a:src/spreadsheet/grid.tsx` is the reference): `truncate` on every cell, `cursor-pointer text-sky-600 underline decoration-sky-600/40 dark:text-sky-400` for link cells, plain `cell.text`; drop the Icon/link-chip imports.
2. Delete src/spreadsheet/link-chip.ts and src/spreadsheet/link-chip.test.ts.
3. components/ui/icon-registry.ts and icon-extended.tsx: remove only the icon names added by sheet-link-chips-fix (Figma, Notion, Slack, Telegram, Youtube, GoogleDoc, GoogleDrive) if nothing else uses them (grep first); leave Github, FileText, Globe.
4. package.json and package-lock.json root version -> 0.8.7. CHANGELOG.md: add above 0.8.6:

## 0.8.7 — 2026-10-17

### Changed

- Spreadsheets: link cells are shown as underlined links again, as before 0.8.6.

## Completion
- [x] Restore the pre-0.8.6 spreadsheet link display and release version 0.8.7.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `sheet-link-chips-revert`).
