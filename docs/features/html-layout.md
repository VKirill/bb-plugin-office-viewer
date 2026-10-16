---
title: HTML layout on devices
type: component
created: 2026-10-16
updated: 2026-10-16
status: active
confidence: medium
tags: [html, responsive, devices, layout]
sources:
  - src/html/html.tsx
  - src/html/devices.ts
  - src/html/capture.ts
  - server.ts
  - app.tsx
---

# HTML layout on devices

TL;DR: The HTML opener shows a page inside realistic phone, tablet, laptop and monitor mockups. It lays the page out at each device's real CSS size, rotates phones and tablets, and puts several devices side by side. BB's own preview with the source is one click away.

## Purpose

Check how a page's layout behaves on the screens people actually use, without leaving BB: breakpoints, orientation queries and how much room the browser leaves the page.

## How it works

1. BB routes `.html` and `.htm` to `HtmlOpener` (`app.tsx`; `src/html/html.tsx`).
2. The opener calls RPC `open`, which returns a preview link rooted at the file's folder (`server.ts`). It downloads the HTML, decodes it in the charset the page declares and passes it as `srcdoc`. Before that it adds a `<base>` pointing at the folder, so relative CSS, scripts and images load, plus the screenshot agent (`src/html/capture.ts`). Every reload asks for a fresh link, because a link lives ten minutes.
3. Each device is a `mockup()`: the case around the screen, plus the system bars on it. Bars are the status bar with the notch, Dynamic Island or camera hole, the home indicator, the browser's tabs and address bar, the macOS menu bar and the Windows taskbar. The page iframe gets the rest as its viewport (`src/html/devices.ts`).
4. The mockup is drawn at the device's CSS pixels and scaled as a whole. `fitGrid()` picks the number of columns and the scale that show all devices largest in the panel (`src/html/devices.ts`).
5. The iframe is sandboxed like BB's own HTML preview (`allow-scripts allow-forms allow-popups allow-modals`, no same origin), so the page can't reach BB (`src/html/html.tsx`).
6. Screenshot: each page draws its own viewport with modern-screenshot, after its scripts have run. The plugin server serves the library at `GET /capture/modern-screenshot.js`. The sandbox can't read the site's files, so the page asks the viewer for them over `postMessage`, and the viewer serves files from the site's folder only (`insideSite`). Only one screen is drawn. The shot includes only elements on screen and loads only pictures on screen; others get a blank pixel. Off-screen pictures that haven't loaded (lazy ones) are swapped for same-sized stand-ins for the moment, because the library would otherwise wait out its timeout for them. Default styles are measured in a shadow root, because the library's own hidden iframe can't be read in a sandbox. The `@font-face` rules are collected and their files inlined. About a second after a page loads, its on-screen pictures and fonts are fetched in the background. Each file is fetched once for all devices and scaled down to 1600 px, so a press doesn't wait for the network. The pages come back as JPEG and replace the iframes for a moment. The mockups are drawn into one transparent WebP, at most about 1600 px across, captions excluded, and it is attached to the draft. Without the attachment slot, it is saved next to the file and its path is mentioned. Works in any browser and in the BB app; no screen-sharing permission.

| Control | Behaviour |
|---|---|
| One device / compare | One mockup, or the chosen set of devices in rows. |
| Device | Presets grouped as phones, tablets, laptops and monitors, with screen shares; ★ marks the main ones. Or **Custom size**, which has drag handles. |
| ★ Main screens only | In compare mode: 360×800, 414×896, 768×1024, 1366×768 and 1920×1080, the narrowest and widest common screens of each kind. They are also the default set. |
| Width × height | Typing a size switches to a custom size. |
| Rotate | Turns phones and tablets (a custom size swaps its sides); computers stay as they stand. |
| Scale | Fit the panel, or 25–100 %. |
| Breakpoint ruler | Ticks at common media-query widths over the page; a click tries that width. |
| Screenshot | The devices as they are now, in their mockups, as one WebP in the draft with a caption listing the sizes. About a second for one device, a few for five. |
| Reload / new tab / full screen / source | Reloads the frames, opens the page in a browser tab, fills the screen, shows BB's preview (`Original`). |

## Business rules

- Presets and shares come from StatCounter screen-resolution statistics for Russia, September 2026. Duplicate widths are left out. Phones and tablets are stored upright, computers wide (`src/html/devices.ts`).
- Because the page runs from `srcdoc`, `location.href` is `about:srcdoc`; relative URLs and `fetch` still resolve through `<base>`. An SPA router that reads `location.pathname` may start on a different route than in a real tab: **Open in a new browser tab** shows it as served.
- The page sees the viewport, not the full screen. For example, a Full HD monitor leaves the page 1920×952 under the browser and the taskbar. The caption shows both sizes.
- User agent, touch input and device pixel ratio are not emulated; only the viewport size is.
- The setup (mode, device, rotation, scale, ruler, compared devices) is kept in `localStorage` under `office-viewer:html-layout`. Unknown preset ids fall back to the defaults.
- A page that loads files from outside its folder (`../` or `/`) won't find them, because the preview link is rooted at the file's folder.

## Public API

| Import or call | File | Purpose |
|---|---|---|
| `HtmlOpener`, `HTML_EXTENSIONS` | `src/html/html.tsx` | Opener UI and extension registration. |
| `DEVICES`, `MAIN_DEVICES`, `mockup()`, `fitGrid()`, `turned()` | `src/html/devices.ts` | Presets, mockup geometry, fitting. |
| `prepareHtml()`, `decodeHtml()`, `insideSite()` | `src/html/capture.ts` | The page with `<base>` and the screenshot agent; which files the page may read. |
| GET `/capture/modern-screenshot.js` | `server.ts` | modern-screenshot for the page and the viewer. |
| RPC `open`, `writeImage` | `server.ts` | Preview link; saving a screenshot next to the file. |
