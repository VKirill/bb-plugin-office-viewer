## Now
- Open and edit `.xlsx`, `.xlsm`, `.csv`, and `.tsv` spreadsheets with formula support, search, range quoting, and URL link chips with brand icons and friendly hyperlink names.
- View Word, PowerPoint, and PDF documents with their supported search, navigation, zoom, and chat quoting controls.
- View images, video, and audio; annotate and save images, capture video frames, and browse image siblings.
- Open HTML pages and websites on devices, including WebP page snapshots.

## Blocked
- Marketplace PR #583 awaits the maintainer's `v1-change` label.

## Next
- Follow up on marketplace PR #583 when the maintainer label is available.

## Last verify
- command: `npx tsc --noEmit`; `node --experimental-strip-types --test src/spreadsheet/link-chip.test.ts`
- result: green (typecheck; 4 tests passed)
- when: 2026-10-17

## Pointers
- Open todos: none (`.agents/todos/INDEX.md` does not exist).
- Active plans: none.
- [Changelog](CHANGELOG.md) — project memory updates.
