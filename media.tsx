// Office Viewer — media opener: images, GIFs and videos with Download and
// Copy. The file is loaded into a Blob because BB's preview links don't answer
// Range requests: Safari won't play a video from them and Chrome can't seek.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { detectLocale, t } from "./i18n";
import { extensionOf } from "./sheet";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico"] as const;
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "webm", "mov", "ogv"] as const;
export const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

/** Larger videos stream from the preview link instead of being held in memory. */
const MAX_BLOB_BYTES = 512 * 1024 * 1024;

type Media = { src: string; blob: Blob | null; hostName: string; absPath: string; sizeBytes: number | null };

function formatSize(bytes: number) {
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

export function MediaOpener({ path, source }: PluginFileOpenerProps) {
  const rpc = useRpc<typeof rpcContract>();
  const locale = detectLocale();
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
  const fileName = path.slice(path.lastIndexOf("/") + 1);

  const [media, setMedia] = useState<Media | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playError, setPlayError] = useState(false);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);

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
      if (isVideo && length !== null && length > MAX_BLOB_BYTES) {
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
  }, [rpc, request, isVideo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    if (media?.blob) URL.revokeObjectURL(media.src);
  }, [media]);

  useEffect(() => () => void generation.current++, []);

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
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "c" && !isVideo) {
      event.preventDefault();
      copy();
    } else if (key === "s") {
      event.preventDefault();
      void download();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-medium" title={media?.absPath ?? path}>{fileName}</div>
          {media ? (
            <div className="truncate text-xs text-muted-foreground">
              {media.hostName}{media.sizeBytes !== null ? ` · ${formatSize(media.sizeBytes)}` : ""}
            </div>
          ) : null}
        </div>
        {!isVideo ? (
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

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/30 p-2">
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center text-sm">
            <span className="font-medium">{t("openFailed")}</span>
            <span className="max-w-lg break-words text-muted-foreground">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>{t("retry")}</Button>
          </div>
        ) : !media ? (
          <div role="status" className="text-sm text-muted-foreground">{t("loading")}</div>
        ) : isVideo ? (
          <div className="flex max-h-full max-w-full flex-col items-center gap-2">
            <video key={media.src} src={media.src} controls playsInline preload="metadata" className="max-h-full max-w-full" onError={() => setPlayError(true)} />
            {playError ? <span role="alert" className="text-center text-xs text-muted-foreground">{t("cantPlay")}</span> : null}
          </div>
        ) : (
          <img src={media.src} alt={fileName} className="max-h-full max-w-full object-contain" draggable />
        )}
      </div>
    </div>
  );
}
