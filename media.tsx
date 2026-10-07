// Office Viewer — media opener: images, GIFs, videos and audio with Download
// and Copy; images open in the editor, video frames can be grabbed into it. The file is loaded into a Blob because BB's preview links don't answer
// Range requests: Safari won't play a video from them and Chrome can't seek.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon, PictureInPictureOnIcon, RepeatIcon } from "@hugeicons/core-free-icons";
import { useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { detectLocale, t } from "./i18n";
import { extensionOf } from "./sheet";
import { AudioPlayer } from "./audio-player";
import { ImageEditor, canvasFromBlob, type ImageFormat, type WriteImage } from "./image-editor";
import { ImageViewer, type ImageViewerHandle } from "./image-viewer";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"] as const;
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "webm", "mov", "ogv"] as const;
export const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "weba"] as const;
export const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS];

const OVERWRITABLE: Record<string, ImageFormat> = { png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp" };
const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
/** Seconds one ,/. press moves a paused video: a frame at 30 fps. */
const FRAME = 1 / 30;

function clock(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

/** Larger videos and recordings stream from the preview link instead of being held in memory. */
const MAX_BLOB_BYTES = 512 * 1024 * 1024;

type Media = { src: string; blob: Blob | null; hostName: string; absPath: string; sizeBytes: number | null };

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The system clipboard takes images only as PNG, so other formats are redrawn (a GIF copies its first frame). */
async function pngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("PNG encoding failed"))), "image/png"));
}

export function MediaOpener({ path: openedPath, source }: PluginFileOpenerProps) {
  const rpc = useRpc<typeof rpcContract>();
  const locale = detectLocale();
  /** The opened file, or a neighbour the user stepped to with ←/→. */
  const [path, setPath] = useState(openedPath);
  const request = useMemo(
    () => ({
      path,
      locale,
      source: {
        kind: source.kind,
        threadId: source.threadId,
        environmentId: source.environmentId,
        projectId: source.projectId,
        hostId: source.experimental_hostId ?? null,
      },
    }),
    [path, locale, source.kind, source.threadId, source.environmentId, source.projectId, source.experimental_hostId],
  );
  const isVideo = (VIDEO_EXTENSIONS as readonly string[]).includes(extensionOf(path));
  const isAudio = (AUDIO_EXTENSIONS as readonly string[]).includes(extensionOf(path));
  const isImage = !isVideo && !isAudio;
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  const folder = path.slice(0, path.lastIndexOf("/") + 1);

  const [media, setMedia] = useState<Media | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playError, setPlayError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ image: HTMLCanvasElement; name: string; overwrite: ImageFormat | null } | null>(null);
  const [neighbours, setNeighbours] = useState<string[]>([]);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const generation = useRef(0);
  const viewer = useRef<ImageViewerHandle>(null);
  const video = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // BB reuses the opener when a tab switches files; drop the old file's editor with it.
  useEffect(() => {
    setPath(openedPath);
    setEditing(null);
  }, [openedPath]);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    setPlayError(false);
    try {
      const opened = await rpc.call("open", request);
      const response = await fetch(`${opened.url}${opened.url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? t("fileMissing", { path: opened.absPath }) : `HTTP ${response.status}`);
      const length = Number(response.headers.get("content-length")) || null;
      let next: Media;
      if ((isVideo || isAudio) && length !== null && length > MAX_BLOB_BYTES) {
        void response.body?.cancel();
        next = { src: opened.url, blob: null, hostName: opened.hostName, absPath: opened.absPath, sizeBytes: length };
      } else {
        const blob = await response.blob();
        next = { src: URL.createObjectURL(blob), blob, hostName: opened.hostName, absPath: opened.absPath, sizeBytes: blob.size };
      }
      if (current !== generation.current) {
        if (next.blob) URL.revokeObjectURL(next.src);
        return;
      }
      setMedia(next);
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [rpc, request, isVideo, isAudio]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    if (media?.blob) URL.revokeObjectURL(media.src);
  }, [media]);

  useEffect(() => () => void generation.current++, []);

  const siblingsRequest = isImage ? JSON.stringify({ ...request, path: openedPath }) : null;
  useEffect(() => {
    if (!siblingsRequest) return setNeighbours([]);
    let alive = true;
    rpc
      .call("siblings", JSON.parse(siblingsRequest) as typeof request)
      .then(({ names }) => alive && setNeighbours(names.filter((name) => (IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(name)))))
      .catch(() => alive && setNeighbours([]));
    return () => void (alive = false);
  }, [rpc, siblingsRequest]);
  const position = neighbours.indexOf(fileName);
  const step = (delta: 1 | -1) => {
    if (neighbours.length < 2 || editing) return;
    const next = neighbours[(Math.max(0, position) + delta + neighbours.length) % neighbours.length]!;
    setPath(folder + next);
  };

  const write: WriteImage = async (name, blob, overwrite) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return rpc.call("writeImage", { ...request, name, base64: btoa(binary), overwrite });
  };

  const edit = async () => {
    if (!media?.blob || !isImage) return;
    try {
      setEditing({ image: await canvasFromBlob(media.blob), name: fileName, overwrite: OVERWRITABLE[extensionOf(path)] ?? null });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    }
  };

  /** The paused frame, at the video's own resolution, into the editor. */
  const grabFrame = () => {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    element.pause();
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    try {
      canvas.getContext("2d")!.drawImage(element, 0, 0);
      canvas.getContext("2d")!.getImageData(0, 0, 1, 1);
    } catch {
      toast.error(t("frameUnavailable"));
      return;
    }
    setEditing({ image: canvas, name: `${fileName.replace(/\.[^.]+$/, "")}-${clock(element.currentTime)}.png`, overwrite: null });
  };

  const changeRate = (next: number) => {
    setRate(next);
    if (video.current) video.current.playbackRate = next;
  };

  const download = async () => {
    if (!media) return;
    let href = media.src;
    if (!media.blob) {
      try {
        href = (await rpc.call("open", request)).url;
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : String(cause));
        return;
      }
    }
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
  };

  const copy = () => {
    if (!media?.blob) return;
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      toast.error(t("copyUnsupported"));
      return;
    }
    // The item is created inside the click so Safari keeps the user gesture.
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": pngBlob(media.blob) })])
      .then(() => toast.success(media.blob!.type === "image/gif" ? t("copiedGifFrame") : t("imageCopied")))
      .catch((cause: unknown) => toast.error(`${t("copyFailed")}: ${cause instanceof Error ? cause.message : String(cause)}`));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (editing || (event.target as HTMLElement).closest("input, textarea, select")) return;
    const key = event.key.toLowerCase();
    if (event.altKey) return;
    if (event.metaKey || event.ctrlKey) {
      if (key === "c" && isImage) {
        event.preventDefault();
        copy();
      } else if (key === "s") {
        event.preventDefault();
        void download();
      } else if (isImage && (key === "=" || key === "+")) {
        event.preventDefault();
        viewer.current?.zoomIn();
      } else if (isImage && key === "-") {
        event.preventDefault();
        viewer.current?.zoomOut();
      } else if (isImage && key === "0") {
        event.preventDefault();
        viewer.current?.fit();
      }
      return;
    }
    if (isImage) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
      } else if (key === "e") {
        event.preventDefault();
        void edit();
      }
    } else if (isVideo && video.current && event.target === rootRef.current) {
      const element = video.current;
      if (key === " " || key === "k") {
        event.preventDefault();
        if (element.paused) void element.play(); else element.pause();
      } else if (key === "," || key === ".") {
        event.preventDefault();
        element.pause();
        element.currentTime = Math.max(0, element.currentTime + (key === "," ? -FRAME : FRAME));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        element.currentTime = Math.max(0, element.currentTime + (event.key === "ArrowLeft" ? -5 : 5));
      } else if (key === "f") {
        event.preventDefault();
        void element.requestFullscreen?.();
      }
    }
  };

  if (editing) {
    return (
      <ImageEditor
        image={editing.image}
        name={editing.name}
        overwriteFormat={editing.overwrite}
        write={write}
        onClose={() => { setEditing(null); requestAnimationFrame(() => rootRef.current?.focus()); }}
        onSaved={(saved, overwrite) => {
          if (overwrite) {
            setEditing(null);
            void load();
          }
          if (isImage) setNeighbours((names) => (names.includes(saved.name) ? names : [...names, saved.name].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))));
        }}
      />
    );
  }

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-background outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-medium" title={media?.absPath ?? path}>{fileName}</div>
          {media ? (
            <div className="truncate text-xs text-muted-foreground">
              {media.hostName}{media.sizeBytes !== null ? ` · ${formatSize(media.sizeBytes)}` : ""}
            </div>
          ) : null}
        </div>
        {isImage ? (
          <span title={`${t("editImage")} (E)`} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void edit()} disabled={!media?.blob}>
            <Icon name="Edit" className="size-4" /> {t("editImage")}
          </Button></span>
        ) : null}
        {isImage ? (
          <span title={t("copyImageHint")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={copy} disabled={!media?.blob}>
            <Icon name="Copy" className="size-4" /> {t("copyImage")}
          </Button></span>
        ) : null}
        <span title={t("downloadHint")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void download()} disabled={!media}>
          <Icon name="Download" className="size-4" /> {t("download")}
        </Button></span>
        <span title={t("refresh")} className="shrink-0"><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => void load()} disabled={loading} aria-label={t("refresh")}>
          <Icon name={loading ? "Spinner" : "ArrowReloadHorizontal"} className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button></span>
      </div>

      <div className={isImage && media ? "relative min-h-0 flex-1 bg-muted/30" : "flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/30 p-2"}>
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center text-sm">
            <span className="font-medium">{t("openFailed")}</span>
            <span className="max-w-lg break-words text-muted-foreground">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>{t("retry")}</Button>
          </div>
        ) : !media ? (
          <div role="status" className="text-sm text-muted-foreground">{t("loading")}</div>
        ) : isAudio ? (
          <AudioPlayer src={media.src} blob={media.blob} />
        ) : isVideo ? (
          <div className="flex h-full w-full min-h-0 flex-col items-center justify-center gap-2">
            <video
              ref={video}
              key={media.src}
              src={media.src}
              controls
              playsInline
              loop={loop}
              preload="metadata"
              className="aspect-video max-h-[calc(100%-2.75rem)] min-h-0 w-full max-w-4xl rounded-md bg-black object-contain"
              onLoadedMetadata={(event) => { event.currentTarget.playbackRate = rate; }}
              onError={() => setPlayError(true)}
            />
            {playError ? <span role="alert" className="text-center text-xs text-muted-foreground">{t("cantPlay")}</span> : null}
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 text-xs">
              <select
                aria-label={t("speed")}
                title={t("speed")}
                value={rate}
                onChange={(event) => changeRate(Number(event.target.value))}
                className="h-8 rounded-md border border-input bg-transparent px-1.5 tabular-nums"
              >
                {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
              </select>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5" aria-pressed={loop} onClick={() => setLoop((on) => !on)}>
                <HugeiconsIcon icon={RepeatIcon} size={16} /> {t("loop")}
              </Button>
              <span title={t("frameBack")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 tabular-nums" onClick={() => { const v = video.current; if (v) { v.pause(); v.currentTime = Math.max(0, v.currentTime - FRAME); } }}>‹ 1</Button></span>
              <span title={t("frameForward")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 tabular-nums" onClick={() => { const v = video.current; if (v) { v.pause(); v.currentTime += FRAME; } }}>1 ›</Button></span>
              {typeof document !== "undefined" && document.pictureInPictureEnabled ? (
                <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void video.current?.requestPictureInPicture().catch(() => {})}>
                  <HugeiconsIcon icon={PictureInPictureOnIcon} size={16} /> {t("pip")}
                </Button>
              ) : null}
              <span title={t("grabFrameHint")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={grabFrame}>
                <HugeiconsIcon icon={Camera01Icon} size={16} /> {t("grabFrame")}
              </Button></span>
            </div>
          </div>
        ) : (
          <ImageViewer ref={viewer} src={media.src} alt={fileName} position={position >= 0 ? { index: position, total: neighbours.length } : null} onStep={step} />
        )}
      </div>
    </div>
  );
}
