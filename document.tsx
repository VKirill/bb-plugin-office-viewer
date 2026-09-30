// Office Viewer — Word opener. .docx pages are laid out in the browser by
// docx-preview; a legacy binary .doc has no browser renderer, so the server
// extracts its text and the viewer shows that.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { renderAsync } from "docx-preview";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { detectLocale, t } from "./i18n";
import { formatSize } from "./media";
import { extensionOf } from "./sheet";

const LEGACY_EXTENSIONS = ["doc", "dot"];
export const WORD_EXTENSIONS = ["docx", "docm", "dotx", ...LEGACY_EXTENSIONS];

/** Word draws bullets with Symbol/Wingdings glyphs from the Private Use Area; browsers without those fonts show boxes. */
const BULLETS: Record<string, string> = { "\uf0b7": "•", "\uf0a7": "▪", "\uf0a8": "□", "\uf076": "❖", "\uf0d8": "➢", "\uf0fc": "✓", "\uf0e0": "→" };
const BULLET_PATTERN = new RegExp(`[${Object.keys(BULLETS).join("")}]`, "g");

type Info = { hostName: string; absPath: string; sizeBytes: number };
type LegacyText = { body: string; headers: string; footnotes: string; endnotes: string };

export function DocumentOpener({ path, source }: PluginFileOpenerProps) {
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
  const legacy = LEGACY_EXTENSIONS.includes(extensionOf(path));
  const fileName = path.slice(path.lastIndexOf("/") + 1);

  const [info, setInfo] = useState<Info | null>(null);
  const [text, setText] = useState<LegacyText | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const styles = useRef<HTMLDivElement>(null);
  const pageWidth = useRef(0);
  const generation = useRef(0);

  /** Shrinks the Word pages to the panel width, so a phone shows a whole page instead of scrolling sideways. */
  const fit = useCallback(() => {
    const wrapper = pages.current?.firstElementChild as HTMLElement | null;
    if (!wrapper || !viewport.current || !pageWidth.current) return;
    wrapper.style.setProperty("zoom", String(Math.min(1, viewport.current.clientWidth / pageWidth.current)));
  }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      if (legacy) {
        const result = await rpc.call("docText", request);
        if (current !== generation.current) return;
        setInfo({ hostName: result.hostName, absPath: result.absPath, sizeBytes: result.sizeBytes });
        setText({ body: result.body, headers: result.headers, footnotes: result.footnotes, endnotes: result.endnotes });
        return;
      }
      const opened = await rpc.call("open", request);
      const response = await fetch(`${opened.url}${opened.url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? t("fileMissing", { path: opened.absPath }) : `HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (current !== generation.current || !pages.current || !styles.current) return;
      pages.current.replaceChildren();
      styles.current.replaceChildren();
      await renderAsync(bytes, pages.current, styles.current, {
        className: "docx",
        inWrapper: true,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
      });
      if (current !== generation.current) return;
      styles.current.querySelectorAll("style").forEach((style) => {
        const css = style.textContent ?? "";
        const fixed = css.replace(BULLET_PATTERN, (glyph: string) => BULLETS[glyph]);
        if (fixed !== css) style.textContent = fixed;
      });
      // The wrapper centres its pages, so its scrollWidth misses the left overflow: measure the widest page instead.
      const wrapper = pages.current.firstElementChild as HTMLElement | null;
      if (wrapper) {
        const padding = getComputedStyle(wrapper);
        const widest = Math.max(0, ...Array.from(wrapper.querySelectorAll<HTMLElement>("section.docx"), (page) => page.offsetWidth));
        pageWidth.current = widest + parseFloat(padding.paddingLeft) + parseFloat(padding.paddingRight);
      }
      fit();
      setInfo({ hostName: opened.hostName, absPath: opened.absPath, sizeBytes: bytes.byteLength });
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [rpc, request, legacy, fit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => void generation.current++, []);

  useLayoutEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(fit);
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [fit]);

  const download = async () => {
    try {
      const { url } = await rpc.call("open", request);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void download();
    }
  };

  const extra = text ? [text.headers, text.footnotes, text.endnotes].map((part) => part.trim()).filter(Boolean) : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-medium" title={info?.absPath ?? path}>{fileName}</div>
          {info ? <div className="truncate text-xs text-muted-foreground">{info.hostName} · {formatSize(info.sizeBytes)}</div> : null}
        </div>
        <span title={t("downloadHint")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void download()} disabled={!info}>
          <Icon name="Download" className="size-4" /> {t("download")}
        </Button></span>
        <span title={t("refresh")} className="shrink-0"><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => void load()} disabled={loading} aria-label={t("refresh")}>
          <Icon name={loading ? "Spinner" : "ArrowReloadHorizontal"} className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button></span>
      </div>

      {legacy && text ? (
        <div role="note" className="shrink-0 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">{t("legacyDoc")}</div>
      ) : null}

      <div ref={viewport} className="relative min-h-0 flex-1 overflow-auto">
        {error ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
            <span className="font-medium">{t("openFailed")}</span>
            <span className="max-w-lg break-words text-muted-foreground">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>{t("retry")}</Button>
          </div>
        ) : !info ? (
          <div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>
        ) : null}
        <div ref={styles} hidden />
        {legacy ? (
          text && !error ? (
            <div className="mx-auto max-w-3xl p-3">
              <article className="whitespace-pre-wrap break-words rounded-sm bg-white p-6 text-[15px] leading-relaxed text-neutral-900 shadow-sm sm:p-10">
                {text.body.trim() || t("emptyDocument")}
              </article>
              {extra.map((part, index) => (
                <div key={index} className="mt-3 whitespace-pre-wrap break-words rounded-sm bg-white/90 p-4 text-xs text-neutral-700 sm:px-10">{part}</div>
              ))}
            </div>
          ) : null
        ) : (
          <div ref={pages} hidden={!!error} />
        )}
      </div>
    </div>
  );
}
