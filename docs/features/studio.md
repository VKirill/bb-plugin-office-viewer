---
title: Studio tools
type: component
created: 2026-10-18
updated: 2026-10-18
status: active
confidence: medium
tags: [studio, prototype, slides, paint]
sources:
  - app.tsx
  - src/studio/studio-panel.tsx
  - src/studio/tools.tsx
  - src/studio/prototype/builder.tsx
  - src/studio/prototype/canvas.tsx
  - src/studio/prototype/model.ts
  - src/studio/prototype/nested-content.tsx
  - src/studio/prototype/connector-layer.tsx
  - src/studio/prototype/left-pane.tsx
  - src/studio/prototype/inspector.tsx
  - src/studio/prototype/inspector-style-panel.tsx
  - src/studio/prototype/inspector-interactions.tsx
  - src/studio/prototype/shell.tsx
  - src/studio/prototype/preview-player.tsx
  - src/studio/prototype/elements.tsx
  - src/studio/prototype/toolbar.tsx
  - src/studio/prototype/code-export.ts
  - src/studio/slides/editor.tsx
  - src/studio/slides/slide-board.tsx
  - src/studio/slides/presenter.tsx
  - src/studio/paint/paint.tsx
  - src/studio/paint/paint-model.ts
  - server.ts
  - src/studio/slides/model.ts
---

# Studio tools

TL;DR: Studio is a thread panel with a wireframe prototype editor, a slide deck editor and a paint canvas; each tool restores thread session state and persists its documents through RPC (`app.tsx:56-61`; `src/studio/studio-panel.tsx:12-14`; `src/studio/tools.tsx:7-27`).

## Purpose

Studio creates and edits thread-scoped visual documents. The panel chooses prototype, slides or paint, then mounts the selected editor with the current thread ID (`src/studio/studio-panel.tsx:54-76`; `src/studio/tools.tsx:7-27`).

## How it works

1. The app registers Studio as a thread-panel action and adds a settings section; when BB exposes its optional header-action function, it also registers a thread-header entry (`app.tsx:56-61`).
2. The Studio panel presents the available tool cards and switches the selected tool; `StudioToolView` maps `prototype`, `slides` and `paint` to their editor components (`src/studio/studio-panel.tsx:70-90`; `src/studio/tools.tsx:19-27`).
3. Each editor reads its tool state from the thread session. The prototype builder initializes its document, history, selection, zoom, edit scope and canvas state; slides and paint restore their deck or document and selection/view settings (`src/studio/prototype/builder.tsx:266-325`; `src/studio/slides/editor.tsx:39-63`; `src/studio/paint/paint.tsx:67-82`).
4. The prototype editor composes a toolbar, left pane, canvas and inspector inside a responsive shell. The left pane manages pages, element layers, palette, components and styles; the inspector edits canvas or element properties, shared styles and interactions (`src/studio/prototype/builder.tsx:266-325`; `src/studio/prototype/left-pane.tsx:47-106`; `src/studio/prototype/inspector.tsx:33-99`; `src/studio/prototype/shell.tsx:34-97`).
5. `PrototypeCanvas` displays the selected page, elements, selection, grid, guides, comments and interaction handlers. `ElementFace` maps element types to their visual widgets; `NestedContent` renders children of dynamic panels and repeaters, while `ConnectorsLayer` draws visible connector paths, labels and hit areas (`src/studio/prototype/canvas.tsx:19-78`; `src/studio/prototype/elements.tsx:73-140`; `src/studio/prototype/nested-content.tsx:14-73`; `src/studio/prototype/connector-layer.tsx:15-74`).
6. The prototype preview materializes the active page from interaction state and dispatches configured element events; the toolbar exposes document actions such as undo/redo, save, preview, history, export, publish and chat send (`src/studio/prototype/preview-player.tsx:22-81`; `src/studio/prototype/toolbar.tsx:18-90`).
7. Prototype saves serialize JSON and an optional PNG to thread storage. Autosave writes the current JSON and snapshot requests; code export emits one React TSX starting component per page and a README (`src/studio/prototype/builder.tsx:1264-1303`; `src/studio/prototype/code-export.ts:142-167`; `server.ts:119-133`; `server.ts:571-611`).
8. The slide editor maintains a bounded undo timeline, edits its active slide on `SlideBoard`, and persists the deck JSON with a PNG capture. The presenter displays the current slide and advances or reverses with keyboard controls (`src/studio/slides/editor.tsx:35-70`; `src/studio/slides/editor.tsx:96-125`; `src/studio/slides/slide-board.tsx:54-129`; `src/studio/slides/presenter.tsx:11-76`).
9. Paint starts or restores a canvas and shape list, then saves a versioned paint JSON sidecar with the rendered PNG (`src/studio/paint/paint.tsx:67-118`; `src/studio/paint/paint-model.ts:5-42`).

| Tool or state | Inputs and behavior | Output and failure behavior |
|---|---|---|
| Prototype | Multi-page wireframe document with elements, components, styles, interactions, comments and responsive page views; canvas selection and edits feed document history (`src/studio/prototype/builder.tsx:280-323`; `src/studio/prototype/canvas.tsx:19-78`). | Saves JSON and optional PNG under thread storage; invalid wireframe JSON is rejected by the server parser (`server.ts:571-592`). Code export is a React starting point (`src/studio/prototype/code-export.ts:142-166`). |
| Prototype nested elements | Dynamic panels render the active state or ghost all states in view-all mode; repeaters render data as cards or a table (`src/studio/prototype/nested-content.tsx:25-73`). | Children are laid out from their parent-relative coordinates. Invalid document state is rejected by the wireframe parser on save (`server.ts:571-574`). |
| Prototype preview | Active-page view with device view, hotspot/notes toggles and interaction dispatch (`src/studio/prototype/preview-player.tsx:22-47`; `src/studio/prototype/preview-player.tsx:67-81`). | Interaction state changes locally; link actions open a new window and wait actions are run asynchronously (`src/studio/prototype/preview-player.tsx:67-81`). |
| Slides | Deck of wireframe elements on 1280×720 canvas defaults, with layouts, slide notes, editing, undo/redo and presentation (`src/studio/slides/model.ts:13-40`; `src/studio/slides/editor.tsx:35-70`). | Saves JSON and PNG to thread storage; capture failure stops an explicit save (`src/studio/slides/editor.tsx:96-109`; `server.ts:300-312`). |
| Paint | Blank or existing canvas; pen, marker, shapes, text, blur and numbered steps are represented as structured paint shapes (`src/studio/paint/paint-model.ts:8-42`; `src/studio/paint/paint-model.ts:47-79`). | Saves versioned JSON and PNG; JSON validation caps each canvas edge at 8192 and shape count at 4000 (`src/studio/paint/paint-model.ts:65-79`; `src/studio/paint/paint.tsx:98-118`). |

## Business rules

- Prototype selection can enter page or nested edit scope; inspector style controls apply to one or multiple selected elements, and interaction controls append event/action definitions (`src/studio/prototype/builder.tsx:301`; `src/studio/prototype/inspector-style-panel.tsx:52-88`; `src/studio/prototype/inspector-interactions.tsx:18-48`).
- Connectors are rendered separately from element faces and omit hidden connectors; their visible paths use connector routing, arrow markers, dashed style, opacity and labels (`src/studio/prototype/connector-layer.tsx:28-70`).
- Generated prototype code uses absolute positions and Tailwind-style classes and is explicitly described as a starting point to refine before shipping (`src/studio/prototype/code-export.ts:142-166`).
- Slide-board captures render at scale 2 as PNG and filter editor-only elements marked `data-proto-skip` (`src/studio/slides/slide-board.tsx:117-129`).
- Paint documents use format `bb-paint`, version 1; slides use `bb-slides`, version 1 (`src/studio/paint/paint-model.ts:5-6`; `src/studio/slides/model.ts:13-16`).

## Public API or commands

| Import or call | File | Purpose |
|---|---|---|
| `StudioPanel`, `StudioToolView` | `src/studio/studio-panel.tsx:12-14`; `src/studio/tools.tsx:25-27` | Select and mount a thread tool. |
| `PrototypeBuilder`, `PrototypeCanvas`, `PrototypeToolbar` | `src/studio/prototype/builder.tsx:266-325`; `src/studio/prototype/canvas.tsx:19-78`; `src/studio/prototype/toolbar.tsx:18-90` | Build and operate wireframe prototypes. |
| `PrototypeLeftPane`, `PrototypeInspector`, `InspectorStylePanel`, `InspectorInteractionsPanel` | `src/studio/prototype/left-pane.tsx:47-106`; `src/studio/prototype/inspector.tsx:33-99`; `src/studio/prototype/inspector-style-panel.tsx:52-88`; `src/studio/prototype/inspector-interactions.tsx:18-48` | Manage pages/layers and edit element styles and interactions. |
| `PrototypeShell`, `ElementFace`, `NestedContent`, `ConnectorsLayer` | `src/studio/prototype/shell.tsx:34-97`; `src/studio/prototype/elements.tsx:73-140`; `src/studio/prototype/nested-content.tsx:14-73`; `src/studio/prototype/connector-layer.tsx:15-74` | Layout and render the prototype editor and element content. |
| `PrototypePreviewPlayer`, `buildPageComponent`, `buildWireframeCodeExport` | `src/studio/prototype/preview-player.tsx:22-81`; `src/studio/prototype/code-export.ts:142-167` | Preview interactions and generate TSX files. |
| `SlidesEditor`, `SlideBoard`, `SlidesPresenter` | `src/studio/slides/editor.tsx:39-70`; `src/studio/slides/slide-board.tsx:54-129`; `src/studio/slides/presenter.tsx:11-83` | Edit, capture and present slide decks. |
| `PaintCanvas`, `parsePaintDoc` | `src/studio/paint/paint.tsx:67-118`; `src/studio/paint/paint-model.ts:81-88` | Edit and validate paint documents. |
| Studio RPC methods | `server.ts:119-320` | Persist and list prototypes, history, slides and paint; read prototype assets/design input; publish and export. |

## Gotchas

- Prototype preview runs the interaction model in the viewer; it does not call application services for configured `openLink` or `wait` actions (`src/studio/prototype/preview-player.tsx:67-81`).
- Prototype and slide content use the wireframe element model; editing and presenting use shared element rendering components (`src/studio/slides/model.ts:3-11`; `src/studio/slides/presenter.tsx:2-7`).
- Paint and slide documents have separate formats and save RPCs; they are not imported into the file-opener spreadsheet or Office document save paths (`src/studio/paint/paint.tsx:98-118`; `src/studio/slides/editor.tsx:96-125`; `server.ts:262-320`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer architecture](../architecture.md)
- [Office Viewer data model](../data-model.md)
- [Office Viewer overview](../overview.md)
