# Changelog

## 0.8.1 — 2026-10-16

### Fixed

- HTML screenshots no longer wait for unloaded images below the visible viewport, avoiding timeouts on long pages with lazy-loaded media.
- Capture only visible content, preload visible images and fonts, and reuse assets across compared devices.
- Resize large images and attach a smaller WebP composite, up to about 1600 pixels wide, for faster capture and chat attachment.
- Preserve sandboxed page styles and loaded web fonts in screenshots; verify that the embedded capture script parses correctly.

## 0.8.0 — 2026-10-16

### Added

- HTML layout viewer for `.html` and `.htm`: the page laid out at real device sizes inside realistic mockups. Phones show a notch, Dynamic Island or camera hole, a status bar and a home indicator. The iPad has a home button. Laptops and monitors have a browser window, the macOS menu bar or the Windows taskbar. The page gets only the viewport left by these bars.
- Screens from StatCounter (Russia, September 2026) with their shares. Five main ones are marked ★: 360×800, 414×896, 768×1024, 1366×768 and 1920×1080.
- Compare mode puts several devices side by side and picks the rows that show them largest in the panel. **★ Main screens only** selects the main set.
- Rotating phones and tablets; a custom size with drag handles; a breakpoint ruler; scale to fit or 25–100 %; reload; opening in a new tab; full screen; BB's own preview with the source.
- Screenshot of the devices into the chat as one PNG. Each sandboxed page draws itself after its scripts have run, with modern-screenshot. It works in any browser and in the BB app, without a screen-sharing prompt.
