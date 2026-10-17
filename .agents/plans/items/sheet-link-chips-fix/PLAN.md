# Fix spreadsheet link chips: brand icons and friendly names

Two defects in the just-merged link chips (src/spreadsheet/link-chip.ts, grid.tsx):

1. linkIcon returns "Figma", "Notion", "Slack", "Telegram", "Youtube" but these names are not registered builtin icons (components/ui/icon-registry.ts EXTENDED_ICON_NAMES + components/ui/icon-extended.tsx map; only "Github", "FileText", "Globe" exist). Icon then falls back to "Zap" (a lightning bolt). Register them: add the names to EXTENDED_ICON_NAMES in icon-registry.ts and map them in icon-extended.tsx to the free Hugeicons `FigmaIcon`, `Notion01Icon`, `SlackIcon`, `TelegramIcon`, `YoutubeIcon` from @hugeicons/core-free-icons (follow how `Github: GithubIcon` is done). Also map docs.google.com -> `GoogleDocIcon` and drive.google.com -> `GoogleDriveIcon` under new names "GoogleDoc"/"GoogleDrive" instead of FileText. In grid.tsx pass `fallback="Globe"` to the chip's Icon so an unknown name never shows Zap.
2. The chip always shows linkLabel(cell.link). For an xlsx hyperlink with a friendly name (sheet.ts: link from raw.l.Target, text is the display text) the friendly text is lost. Show `linkLabel(cell.link)` only when `cell.text.trim()` equals the link (or is empty); otherwise show cell.text.

Add a test in link-chip.test.ts asserting every name linkIcon can return is in the builtin icon name list (import EXTENDED_ICON_NAMES / core names from the registry if importable under node --experimental-strip-types; otherwise export the list of icon names from link-chip.ts and assert against EXTENDED_ICON_NAMES). If the chip-text choice is extracted to a helper (e.g. `chipText(text, link)` in link-chip.ts), test it too.

## Completion
- [x] Register every link-chip brand icon with a Globe fallback and preserve hyperlink friendly names.
- [x] Cover the returned icon names and friendly-name behavior in `link-chip.test.ts`.

### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `sheet-link-chips-fix`).
