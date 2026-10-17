---
title: HTML layout on devices
type: component
created: 2026-10-16
updated: 2026-10-17
status: active
confidence: medium
tags: [html, responsive, devices, layout]
sources:
  - src/html/html.tsx
  - src/html/devices.ts
  - src/html/capture.ts
  - server.ts
  - app.tsx
  - src/html/site.tsx
  - src/server/web.ts
---

# HTML layout on devices

TL;DR: The HTML opener shows a page inside realistic phone, tablet, laptop and monitor mockups. It lays the page out at each device's real CSS size, rotates phones and tablets, and puts several devices side by side. BB's own preview with the source is one click away.

## Purpose

Check how a page's layout behaves on the screens people actually use, without leaving BB: breakpoints, orientation queries and how much room the browser leaves the page.

## How it works

1. BB routes `.html` and `.htm` to `HtmlOpener`, which preserves the BB source context in its `open` request (`app.tsx:5-7`; `src/html/html.tsx:493-520`).
2. The opener requests a fresh preview URL, adds a cache buster to the fetch, decodes the response, and passes the page to `DevicesViewer` (`src/html/html.tsx:511-536`). `prepareHtml` inserts a `<base>` only when the page has no existing one, then inserts the screenshot library and agent after `<head>` or `<html>`; fragments without either receive the scripts at the start (`src/html/capture.ts:165-176`). The library URL is absolute, so the page's `<base>` does not redirect the script request (`src/html/html.tsx:571-582`; `src/html/capture.ts:6`).
3. Each device is a `mockup()`: the case around the screen, plus the system bars on it. Bars are the status bar with the notch, Dynamic Island or camera hole, the home indicator, the browser's tabs and address bar, the macOS menu bar and the Windows taskbar. The page iframe gets the rest as its viewport (`src/html/devices.ts`).
4. The mockup is drawn at the device's CSS pixels and scaled as a whole. `fitGrid()` picks the number of columns and the scale that show all devices largest in the panel (`src/html/devices.ts`).
5. The iframe is sandboxed like BB's own HTML preview (`allow-scripts allow-forms allow-popups allow-modals`, no same origin), so the page can't reach BB (`src/html/html.tsx`).
6. Screenshot: the sandbox agent captures one viewport with modern-screenshot; it filters out off-screen content and substitutes a transparent pixel for unneeded resources. Unloaded off-screen images and videos are temporarily replaced with same-sized spans to avoid waiting for lazy media. The agent collects used `@font-face` rules and asks the parent viewer to fetch site files through `postMessage`; the viewer accepts files under the page scope, caches each URL per load and shrinks image blobs (`src/html/capture.ts:26-44`; `src/html/capture.ts:46-79`; `src/html/capture.ts:128-161`; `src/html/html.tsx:599-620`). The capture result is JPEG; the viewer replaces device frames temporarily, then composes device mockups into a WebP and attaches it to chat or saves it beside the file (`src/html/html.tsx:543-557`; `src/html/html.tsx:599-620`).

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

## Websites

The **Website on devices** panel tab (`src/html/site.tsx:22-32`) displays a fetched public page in the same viewer. It accepts a URL in panel parameters or saved local storage, normalizes missing schemes to HTTPS, and rejects non-HTTP(S) schemes (`src/html/capture.ts:189-200`; `src/html/site.tsx:23-30`).

- The plugin server fetches the page (`webPage`) and, for screenshots, the files of the same site (`webFile`). The page is rendered as `srcdoc`, so remote framing headers do not govern this display. Redirects are followed only to public addresses; loopback, private, link-local and CGNAT addresses are refused (`src/server/web.ts:1-68`; `server.ts:154-162`).
- The website viewer sets the page URL as its base and scopes screenshot reads to the site's origin root (`src/html/site.tsx:36-50`).
- The server fetches without the user's cookies: pages behind a login show as a logged-out visitor sees them.
- HTML file screenshots attach to the chat when the composer slot exists and otherwise use the file's sibling-save path; site screenshots have no file save callback (`src/html/html.tsx:527-532`; `src/html/html.tsx:543-557`).

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
| `HtmlOpener`, `HTML_EXTENSIONS`, `DevicesViewer`, `PageSource` | `src/html/html.tsx` | Opener for files; the device viewer around any page source. |
| `SitePanel`, `BrowserDevicesButton`, `SITE_PANEL` | `src/html/site.tsx` | The website tab and the Browser address-bar button. |
| `SitePanel` | `src/html/site.tsx:23-82` | Load and normalize a website address, then render it through the shared device viewer. |
| `HtmlOpener` | `src/html/html.tsx:493-536` | Load a BB HTML file with its source context and provide screenshot saving. |
| `DevicesViewer` | `src/html/html.tsx:543-602` | Shared viewport, devices, controls and screenshot host for a page source. |
| RPC `webPage`, `webFile`; `fetchPublic()`, `isInternalAddress()` | `server.ts`; `src/server/web.ts` | Server-side fetching of public pages and their files. |
| `DEVICES`, `MAIN_DEVICES`, `mockup()`, `fitGrid()`, `turned()` | `src/html/devices.ts` | Presets, mockup geometry, fitting. |
| `prepareHtml()`, `decodeHtml()`, `insideSite()` | `src/html/capture.ts` | The page with `<base>` and the screenshot agent; which files the page may read. |
| GET `/capture/modern-screenshot.js` | `server.ts` | modern-screenshot for the page and the viewer. |
| RPC `open`, `writeImage` | `server.ts` | Preview link; saving a screenshot next to the file. |
