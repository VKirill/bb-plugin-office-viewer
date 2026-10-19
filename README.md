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

## Documentation

- [Project overview](docs/overview.md)
- [Architecture](docs/architecture.md)
- [Features](docs/features/spreadsheets.md): [spreadsheets](docs/features/spreadsheets.md), [Word and PowerPoint](docs/features/office-documents.md), [PDF](docs/features/pdf.md), [HTML on devices](docs/features/html-layout.md), [media](docs/features/media.md), [Studio](docs/features/studio.md)
- [API](docs/api.md)
- [Data model](docs/data-model.md)
- [Deployment](docs/deployment.md)
- [Gotchas](docs/gotchas.md)
