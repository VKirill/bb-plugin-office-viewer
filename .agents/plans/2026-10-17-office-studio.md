---
title: Office Studio — Axure-like prototypes, Paint and Slides in Office Viewer
status: in progress
research: .bb/chats/thr_wdpmipwdxc/artifacts/axure-analog-research.md
---

# Office Studio

> [!NOTE]
> Owner request (2026-10-17): an Office Viewer icon on the right of the thread header (next to Git History)
> opens a tools tab: a prototype builder (Axure analog: canvas, ready UI elements with name badges),
> Paint (brush drawing) and PowerPoint-like slides. A result is saved in the chat's files and goes
> to the chat as a screenshot and/or a file the agent can read.

## Decisions

| Question | Decision | Why |
| --- | --- | --- |
| Engine for prototypes | Own DOM canvas, elements are real shadcn-style components | No license risk (tldraw is paid, Excalidraw JSON is low-level rectangles); agent reads semantic JSON |
| Placement | Free positioning (Axure style), snap grid 8px | Owner described a canvas |
| Vocabulary | A2UI type names (Button, TextField, ChoicePicker, Checkbox, Card, Image, Table, Modal, Header, Nav, Text, Icon…) | Agents know them |
| File format | `*.wireframe.json`, zod-validated, version 1 | Agent-readable |
| Storage | thread storage `<storageRoot>/Prototypes/` (`bb.sdk.threads.storageLocation` + `bb.sdk.files.write`) | Native per-chat files; agent sees `$BB_THREAD_STORAGE` |
| To chat | `composer.experimental_vkAttachFiles([png, json])`; fallback absolute paths in composer text | Same path as image editor |
| Paint | Extend `src/media/image-editor.tsx`: blank canvas, eraser, palette, perfect-freehand | Research 4.2 |
| Slides | Phase 2, on the prototype engine | Lower priority |

## Tasks

```mermaid
graph LR
  A[studio-launcher] --> B[prototype-builder]
  B --> C[paint-canvas]
  C --> D[slides — later]
```

- [x] `studio-launcher`: header icon + panel tab «Office Studio» with tool cards
- [x] `prototype-builder`: canvas, palette, badges, save/open/export/send
- [x] `paint-canvas`: blank-canvas paint mode, save and send
- [ ] slides (phase 2), components/states (Axure masters, dynamic panels) v2
- [ ] release + live check

### Accepted work
- `lprun_38203a8bf69c43f294a012b07bded797`: `studio-launcher`, `studio-launcher-design`, `prototype-builder`, and `paint-canvas` accepted; Slides and the Studio release/live check remain open.
