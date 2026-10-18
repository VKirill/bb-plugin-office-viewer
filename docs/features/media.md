---
title: Media tools
type: component
created: 2026-10-13
updated: 2026-10-18
status: active
confidence: medium
tags: [media, images, video, audio]
sources:
  - src/media/media.tsx
  - src/media/image-editor.tsx
  - src/media/image-viewer.tsx
  - src/media/audio-player.tsx
  - src/media/chat-image-editor.tsx
  - server.ts
  - app.tsx
---

# Media tools

TL;DR: The media opener displays images, video and audio; it adds image annotation/editing and writes edited images through the plugin server (`src/media/media.tsx:20-23`; `src/media/media.tsx:52-53`).

## Purpose

Open supported media from BB file sources, download files, copy still images, navigate image siblings and edit images or video frames (`src/media/media.tsx:1-3`; `src/media/media.tsx:137-180`).

## How it works

1. The app registers `MediaOpener` for image, video and audio extensions (`app.tsx:8`; `app.tsx:21-25`; `src/media/media.tsx:20-23`).
2. The opener calls `open` and fetches the preview. Images and media up to the blob threshold are held as object URLs; larger video/audio files use the preview URL directly (`src/media/media.tsx:97-125`).
3. Images render in `ImageViewer`; image folder siblings are loaded with `siblings` and filtered to known image extensions (`src/media/media.tsx:137-152`).
4. Image edit decodes the blob to canvas and opens tools for shapes, pen/marker, text, numbered steps, blur and crop; history supports undo/redo (`src/media/media.tsx:154-168`; `src/media/image-editor.tsx:70-82`; `src/media/image-editor.tsx:433-442`).
5. Saving encodes the canvas, converts bytes to base64 and calls `writeImage`; the server writes a selected path on the owning host (`src/media/media.tsx:154-159`; `server.ts:527-547`). Chat image editing uses BB's optional `experimental_vkImageEditor` slot and returns a PNG to BB (`app.tsx:69-75`; `src/media/chat-image-editor.tsx:17-44`).
6. Video uses browser playback controls and can capture its paused frame into the image editor; audio uses `AudioPlayer` with waveform seeking and playback controls (`src/media/media.tsx:170-180`; `src/media/audio-player.tsx:68-127`).

| Mode | Extensions / behavior | Branches and failures |
|---|---|---|
| Images | PNG, JPG/JPEG, GIF, WebP, AVIF, BMP, ICO, SVG; viewer zoom/pan, copy, download, sibling navigation and editor (`src/media/media.tsx:20-23`; `src/media/media.tsx:137-168`). | Editor works on a decoded canvas; unsupported overwrite format makes save a copy (`src/media/image-editor.tsx:363-381`; `src/media/media.tsx:161-168`). |
| Video | MP4, M4V, WebM, MOV, OGV; playback, speed, repeat, frame stepping and frame capture (`src/media/media.tsx:21-22`; `src/media/media.tsx:170-180`). | Over-threshold files use preview URL instead of a blob; browser codec errors are shown (`src/media/media.tsx:35-36`; `src/media/media.tsx:97-125`). |
| Audio | MP3, WAV, OGG, OGA, OPUS, M4A, AAC, FLAC, WEBA; waveform or progress display and playback (`src/media/media.tsx:22-23`; `src/media/audio-player.tsx:1-2`). | Recording waveform generation can fail and playback errors are surfaced by the UI (`src/media/audio-player.tsx:1-20`; `src/media/media.tsx:77-85`). |
| Chat attachment editor | Optional slot; fetches attachment with credentials and returns edited PNG as `File` (`app.tsx:69-75`; `src/media/chat-image-editor.tsx:21-44`). | Registration requires BB to expose `experimental_vkImageEditor`; fetch/decode failure renders an error (`app.tsx:69-75`; `src/media/chat-image-editor.tsx:21-33`). |

## Business rules

- Extension sets are explicit in `media.tsx`; the viewer classifies any non-video/non-audio extension routed to it as an image (`src/media/media.tsx:20-23`; `src/media/media.tsx:71-74`).
- Video/audio larger than 512 MiB stream from the preview URL; smaller files are loaded to a Blob (`src/media/media.tsx:35-36`; `src/media/media.tsx:103-114`).
- Image overwrite formats are PNG, JPEG and WebP; unsupported source formats are saved as copies (`src/media/media.tsx:25`; `src/media/media.tsx:161-165`).
- Server image names cannot contain `/` or begin with `.`, and non-overwrite saves test the requested name plus 98 suffixed alternatives (`server.ts:527-547`).
- Image editor undo history is capped at 60 snapshots (`src/media/image-editor.tsx:63-68`; `src/media/image-editor.tsx:433-438`).

## Public API

| Import or call | File | Purpose |
|---|---|---|
| `MediaOpener`, `MEDIA_EXTENSIONS` | `src/media/media.tsx:20-23`; `src/media/media.tsx:52-53` | Media file routing and UI. |
| `ImageEditor`, `canvasFromBlob`, `canvasBlob` | `src/media/image-editor.tsx:88-109`; `src/media/image-editor.tsx:363-381` | Decode, edit and encode images. |
| `ImageViewer` | `src/media/image-viewer.tsx:1-15` | Pan and zoom image view. |
| `AudioPlayer` | `src/media/audio-player.tsx:68-127` | Audio playback UI. |
| `ChatImageEditor` | `src/media/chat-image-editor.tsx:17-44` | Optional BB attachment editor component. |
| RPC `writeImage`, `siblings` | `server.ts:84-95`; `server.ts:517-547` | List neighboring files and save image bytes. |

## Package shape

`media.tsx` coordinates file loading and mode selection; `image-viewer.tsx`, `image-editor.tsx` and `audio-player.tsx` implement modality-specific controls; `chat-image-editor.tsx` adapts the editor to the optional BB slot (`src/media/media.tsx:1-18`).

## Internal model

The editor stores an image canvas plus annotation shapes in a bounded revision history. A save renders that state into an output Blob; the opener translates it into the base64 RPC payload (`src/media/image-editor.tsx:52-68`; `src/media/image-editor.tsx:433-442`; `src/media/media.tsx:154-159`). The media opener uses generation IDs to ignore stale asynchronous loads and releases temporary object URLs (`src/media/media.tsx:85-95`; `src/media/media.tsx:115-135`).

## Dependencies

The browser handles image/video/audio decoding and playback; Hugeicons supplies icons; BB SDK provides RPC, and the server writes edited image bytes through BB file services (`package.json`; `src/media/media.tsx:6-18`; `server.ts:542-547`).

## Gotchas

- The system clipboard stores still images only; conversion to PNG redraws non-PNG input, so GIF copy captures a still image (`src/media/media.tsx:40-49`).
- The optional chat attachment editor depends on BB exposing `experimental_vkImageEditor` (`app.tsx:69-75`).
- The server write name check blocks slash and leading dot but does not impose an image MIME allowlist (`server.ts:527-547`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [Office Viewer architecture](../architecture.md)
- [Office Viewer gotchas](../gotchas.md)
- [Office Viewer overview](../overview.md)
