# Office Viewer for BB

Office Viewer adds file openers to BB for spreadsheets, Word documents, PowerPoint presentations, PDFs, HTML pages, images, video and audio. Spreadsheet editing, document viewing, media controls and chat quoting are available inside BB.

## Quick start

```sh
npm install
npm run build
bb plugin install .
```

Requires BB 0.43 or later. Choose Office Viewer in BB Settings → File openers if another plugin claims the same extensions.

## Documentation

- [Project overview](docs/overview.md)
- [Architecture](docs/architecture.md)
- [Features](docs/features/spreadsheets.md): [spreadsheets](docs/features/spreadsheets.md), [Word and PowerPoint](docs/features/office-documents.md), [PDF](docs/features/pdf.md), [HTML on devices](docs/features/html-layout.md), [media](docs/features/media.md)
- [API](docs/api.md)
- [Data model](docs/data-model.md)
- [Deployment](docs/deployment.md)
- [Gotchas](docs/gotchas.md)
