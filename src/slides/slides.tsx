// Office Viewer — PowerPoint opener. A .pptx is read in the browser (pptx.ts)
// and drawn slide by slide (slide-view.tsx): thumbnails, a main slide fitted to
// the panel, full-screen presenting, speaker notes and quoting a slide into the chat.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { useComposer, useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../../server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { detectLocale, t } from "../shared/i18n";
import { formatSize } from "../shared/format";
import { extensionOf } from "../spreadsheet/sheet";
import { parsePptx, slideMarkdown, type Deck } from "./pptx";
import { formatBlockquote } from "../shared/quote";
import { ScaledSlide } from "./slide-view";

export const SLIDES_EXTENSIONS = ["pptx", "ppsx", "potx"];
/** Binary PowerPoint files have no browser renderer: the viewer says so and offers Download. */
const LEGACY_EXTENSIONS = ["ppt", "pps", "pot"];
const MAX_BYTES = 30 * 1024 * 1024;
const NARROW = 560;

type Info = { hostName: string; absPath: string; sizeBytes: number | null };
type Size = { width: number; height: number };

/** Tracks an element's content size. */
function useSize(ref: RefObject<HTMLElement | null>, enabled = true): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return size;
}

/** The largest slide-shaped box that fits `area`. */
function fitWidth(deck: Deck, area: Size) {
  return Math.max(0, Math.min(area.width, (area.height * deck.width) / deck.height));
}

function Thumbnail({ deck, index, width, active, onSelect }: { deck: Deck; index: number; width: number; active: boolean; onSelect(): void }) {
  const slide = deck.slides[index];
  const button = useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = button.current;
    if (!element || seen) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setSeen(true), { rootMargin: "300px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen]);

  useEffect(() => {
    if (active) button.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <button
      ref={button}
      type="button"
      onClick={onSelect}
      aria-label={t("slideN", { n: index + 1 })}
      aria-current={active ? "true" : undefined}
      className={cn("relative shrink-0 overflow-hidden rounded-sm border-2 bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-primary" : "border-transparent hover:border-border", slide.hidden && "opacity-50")}
      style={{ width: width + 4, height: (width * deck.height) / deck.width + 4 }}
    >
      {seen ? <ScaledSlide deck={deck} slide={slide} width={width} /> : null}
      <span className="absolute bottom-0 left-0 rounded-tr bg-background/80 px-1 text-[10px] tabular-nums text-foreground">
        {index + 1}{slide.hidden ? ` · ${t("hidden")}` : ""}
      </span>
    </button>
  );
}

export function SlidesOpener({ path, source }: PluginFileOpenerProps) {
  const rpc = useRpc<typeof rpcContract>();
  const composer = useComposer();
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

  const [deck, setDeck] = useState<Deck | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const generation = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const presenter = useRef<HTMLDivElement>(null);
  const bodySize = useSize(body);
  const stageSize = useSize(stage, !!deck);
  const presenterSize = useSize(presenter, presenting);

  const load = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const opened = await rpc.call("open", request);
      if (legacy) {
        if (run === generation.current) setInfo({ hostName: opened.hostName, absPath: opened.absPath, sizeBytes: null });
        return;
      }
      const response = await fetch(`${opened.url}${opened.url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? t("fileMissing", { path: opened.absPath }) : `HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (run !== generation.current) return;
      if (bytes.byteLength > MAX_BYTES) throw new Error(t("tooLarge"));
      let next: Deck;
      try {
        next = parsePptx(bytes);
      } catch {
        throw new Error(t("notPptx"));
      }
      setDeck(next);
      setCurrent((index) => Math.min(index, Math.max(0, next.slides.length - 1)));
      setInfo({ hostName: opened.hostName, absPath: opened.absPath, sizeBytes: bytes.byteLength });
    } catch (cause) {
      if (run === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, [rpc, request, legacy]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => void generation.current++, []);
  useEffect(() => () => deck?.dispose(), [deck]);

  const total = deck?.slides.length ?? 0;
  const slide = deck?.slides[current];
  const hasNotes = !!deck?.slides.some((item) => item.notes);
  const go = useCallback((index: number) => setCurrent(Math.min(Math.max(index, 0), Math.max(0, total - 1))), [total]);

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

  const quote = () => {
    if (!info || !slide) return;
    const text = slideMarkdown(slide);
    if (!text) {
      toast.message(t("slideNoText"));
      return;
    }
    const block = formatBlockquote({ path: info.absPath, host: info.hostName, where: t("slideN", { n: current + 1 }), text });
    composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${block}\n\n`);
    composer.focus();
    toast.success(t("quoted"));
  };

  const stopPresenting = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else setPresenting(false);
  }, []);

  // Full screen where the browser allows it; otherwise the presenter still covers the window.
  useEffect(() => {
    if (!presenting) return;
    const element = presenter.current;
    element?.focus();
    element?.requestFullscreen?.().catch(() => undefined);
    const onChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      root.current?.focus();
    };
  }, [presenting]);

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void download();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || !deck) return;
    const forward = ["ArrowRight", "PageDown"].includes(event.key) || (presenting && [" ", "ArrowDown", "Enter"].includes(event.key));
    const back = ["ArrowLeft", "PageUp"].includes(event.key) || (presenting && ["ArrowUp", "Backspace"].includes(event.key));
    if (forward) go(current + 1);
    else if (back) go(current - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(total - 1);
    else if (event.key === "Escape" && presenting) stopPresenting();
    else return;
    event.preventDefault();
  };

  const narrow = bodySize.width > 0 && bodySize.width < NARROW;
  const stageWidth = deck ? fitWidth(deck, { width: stageSize.width - 24, height: stageSize.height - 24 }) : 0;
  const thumbWidth = narrow ? 96 : 136;

  return (
    <div ref={root} className="flex h-full min-h-0 flex-col bg-background outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-medium" title={info?.absPath ?? path}>{fileName}</div>
          {info ? <div className="truncate text-xs text-muted-foreground">{info.hostName}{info.sizeBytes !== null ? ` · ${formatSize(info.sizeBytes)}` : ""}</div> : null}
        </div>
        {deck && total > 0 ? (
          <div className="flex shrink-0 items-center">
            <span title={t("previousSlide")}><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => go(current - 1)} disabled={current === 0} aria-label={t("previousSlide")}><Icon name="ChevronLeft" className="size-4" /></Button></span>
            <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">{t("slideCount", { i: current + 1, n: total })}</span>
            <span title={t("nextSlide")}><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => go(current + 1)} disabled={current >= total - 1} aria-label={t("nextSlide")}><Icon name="ChevronRight" className="size-4" /></Button></span>
          </div>
        ) : null}
        {hasNotes ? (
          <span title={t("speakerNotes")} className="shrink-0"><Button variant="ghost" size="icon" className={cn("size-8", notesOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground")} onClick={() => setNotesOpen((open) => !open)} aria-pressed={notesOpen} aria-label={t("speakerNotes")}><Icon name="FileText" className="size-4" /></Button></span>
        ) : null}
        {deck && total > 0 ? (
          <>
            <span title={t("present")} className="shrink-0"><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => setPresenting(true)} aria-label={t("present")}><Icon name="Maximize2" className="size-4" /></Button></span>
            <span title={t("quote")} className="shrink-0"><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={quote} aria-label={t("quote")}><Icon name="MessageSquarePlus" className="size-4" /></Button></span>
          </>
        ) : null}
        <span title={t("downloadHint")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void download()} disabled={!info}>
          <Icon name="Download" className="size-4" /> {t("download")}
        </Button></span>
        <span title={t("refresh")} className="shrink-0"><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => void load()} disabled={loading} aria-label={t("refresh")}>
          <Icon name={loading ? "Spinner" : "ArrowReloadHorizontal"} className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button></span>
      </div>

      <div ref={body} className={cn("flex min-h-0 flex-1", narrow ? "flex-col-reverse" : "flex-row")}>
        {error ? (
          <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
            <span className="font-medium">{t("openFailed")}</span>
            <span className="max-w-lg break-words text-muted-foreground">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>{t("retry")}</Button>
          </div>
        ) : legacy && info ? (
          <div role="note" className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
            <span className="max-w-md text-muted-foreground">{t("legacyPpt")}</span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void download()}><Icon name="Download" className="size-4" /> {t("download")}</Button>
          </div>
        ) : !deck ? (
          <div role="status" className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>
        ) : total === 0 ? (
          <div role="status" className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{t("noSlides")}</div>
        ) : (
          <>
            <div
              role="list"
              aria-label={t("slides")}
              className={cn("flex shrink-0 gap-2 overflow-auto border-border p-2", narrow ? "flex-row border-t" : "flex-col border-r")}
            >
              {deck.slides.map((item, index) => (
                <Thumbnail key={index} deck={deck} index={index} width={thumbWidth} active={index === current} onSelect={() => go(index)} />
              ))}
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div ref={stage} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 p-3">
                {slide && stageWidth > 0 ? (
                  <div className="shrink-0 shadow-md ring-1 ring-border"><ScaledSlide deck={deck} slide={slide} width={stageWidth} /></div>
                ) : null}
              </div>
              {notesOpen && slide ? (
                <div className="max-h-[30%] shrink-0 overflow-auto border-t border-border px-3 py-2 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{t("speakerNotes")}</div>
                  {slide.notes ? <div className="whitespace-pre-wrap break-words">{slide.notes}</div> : <div className="text-muted-foreground">{t("noNotes")}</div>}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {presenting && deck && slide ? (
        <div
          ref={presenter}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black outline-none"
          onClick={() => go(current + 1)}
        >
          <ScaledSlide deck={deck} slide={slide} width={fitWidth(deck, presenterSize)} />
          <button
            type="button"
            className="absolute right-3 top-3 rounded-md bg-white/10 px-2 py-1 text-xs text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              stopPresenting();
            }}
          >
            {t("exitPresent")}
          </button>
          <span className="pointer-events-none absolute bottom-3 right-4 text-xs tabular-nums text-white/40">{t("slideCount", { i: current + 1, n: total })}</span>
        </div>
      ) : null}
    </div>
  );
}
