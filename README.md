# Office Viewer for BB

Office Viewer adds file openers to BB for spreadsheets, Word documents, PowerPoint presentations, PDFs, HTML pages, images, video and audio. Its thread Studio panel also creates wireframe prototypes, slide decks and paint canvases.

## Quick start

```sh
npm install
npm run build
bb plugin install .
```

Requires BB 0.43 or later. Choose Office Viewer in BB Settings → File openers if another plugin claims the same extensions.

## Web loading safety

Version 0.8.16 pins each request to validated public IP addresses, including redirects, with fallback among the checked addresses. DNS, connections, redirects and decoded response bodies share a 20-second deadline; decoded responses are limited to 20 MB. Internal and special-purpose ranges are blocked conservatively, so some special-purpose globally reachable addresses are intentionally unavailable. Web errors support English and Russian.

## Document download cache

PDF, Word Open XML, PowerPoint Open XML and spreadsheet viewers reuse downloaded files after the server confirms their ETag with HTTP 304. Each open still checks the server; changed files download again and network errors do not show an offline copy. On BB hosts with the tab-visibility SDK hook, hidden file tabs defer their initial download until shown; older hosts keep loading as before.

**Local storage:** original document bytes and host/path metadata remain in this browser’s IndexedDB, separately from PDF reading positions. Files over 100 MiB are not cached; the cache keeps at most 500 MiB of document bytes. Entries idle for 30 days are rejected on access and pruned during later cache writes. Closing BB does not run cleanup, and deleting a thread or signing out does not clear these copies. To remove them, delete the `office-viewer-file-cache` database in your browser’s site-storage tools; the next open downloads the file again. Storage failures fall back to normal downloads.

## PDF reading position

PDFs remember the page, position within the page, horizontal scroll and zoom per viewing thread in BB’s server-side plugin storage. Reopening that thread on another device restores its place. Refreshing keeps the current passage, and rapid close/reopen shares pending saves. Files opened outside a thread do not persist a reading position.

## Documentation

- [Project overview](docs/overview.md)
- [Architecture](docs/architecture.md)
- [Features](docs/features/spreadsheets.md): [spreadsheets](docs/features/spreadsheets.md), [Word and PowerPoint](docs/features/office-documents.md), [PDF](docs/features/pdf.md), [HTML on devices](docs/features/html-layout.md), [media](docs/features/media.md), [Studio](docs/features/studio.md)
- [API](docs/api.md)
- [Data model](docs/data-model.md)
- [Deployment](docs/deployment.md)
- [Gotchas](docs/gotchas.md)
