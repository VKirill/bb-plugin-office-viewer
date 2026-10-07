// Office Viewer — PDF opener. PDF.js parses and draws the pages; the viewer
// lays them out in one continuous scroll and draws only the pages near the
// viewport. The PDF.js worker is bundled as text and started from a Blob URL,
// so the plugin needs no extra files.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { useComposer, useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";
import workerSource from "pdfjs-dist/legacy/build/pdf.worker.min.mjs" with { type: "text" };
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { detectLocale, t } from "./i18n";
import { formatSize } from "./media";

export const PDF_EXTENSIONS = ["pdf"];

type Library = typeof import("pdfjs-dist");
type Info = { hostName: string; absPath: string; sizeBytes: number };
type Loaded = { lib: Library; doc: PDFDocumentProxy };
type Size = { w: number; h: number };
/** "width" and "page" fit the first page to the panel; a number is a factor where 1 is the actual size. */
type Zoom = "width" | "page" | number;
/** A page's text in lower case, and where each text item starts in it. */
type PageText = { lower: string; starts: number[] };
/** One match: the slices of the page's text items it covers. */
type Hit = { page: number; parts: { item: number; from: number; to: number }[] };

/** Gap between pages and around them, in pixels (matches gap-2 and p-2). */
const PAD = 8;
const CSS_UNITS = 96 / 72;
const MIN_SCALE = 0.1;
const MAX_SCALE = 6;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 3, 4];
/** Browsers refuse canvases much beyond this many pixels (iOS Safari: 16.7 million). */
const MAX_CANVAS_PIXELS = 16_000_000;
const CHUNK = 50;

/** PDF.js text layer styles (pdf_viewer.css) as classes: the text is invisible, selectable and sits over the canvas. */
const TEXT_LAYER = cn(
  "absolute left-0 top-0 origin-top-left overflow-clip text-left leading-none [color-scheme:only_light] selection:bg-blue-500/25 selection:text-transparent",
  "[&>span]:absolute [&>span]:origin-top-left [&>span]:cursor-text [&>span]:select-text [&>span]:whitespace-pre [&>span]:text-transparent",
  "[&>span]:[font-size:calc(var(--text-scale-factor)*var(--font-height,0px))]",
  "[&>span]:[transform:rotate(var(--rotate,0deg))_scaleX(var(--scale-x,1))_scale(var(--min-font-size-inv))]",
  "[&>br]:absolute [&>br]:selection:bg-transparent [&_mark]:rounded-sm [&_mark]:bg-yellow-300/60 [&_mark]:text-transparent [&_mark[data-current]]:bg-orange-400/70",
);

let library: Promise<Library> | null = null;

/** PDF.js is evaluated on the first PDF, not when the plugin loads. */
function loadLibrary() {
  library ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    return lib;
  });
  return library;
}

async function pageText(doc: PDFDocumentProxy, index: number): Promise<PageText> {
  const content = await (await doc.getPage(index + 1)).getTextContent();
  let lower = "";
  const starts: number[] = [];
  for (const item of content.items) {
    if (!("str" in item)) continue;
    starts.push(lower.length);
    lower += item.str.toLowerCase() + (item.hasEOL ? " " : "");
  }
  return { lower, starts };
}

function findHits(texts: PageText[], needle: string): Hit[] {
  const hits: Hit[] = [];
  texts.forEach(({ lower, starts }, page) => {
    for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + needle.length)) {
      const end = at + needle.length;
      let low = 0;
      let high = starts.length - 1;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (starts[middle] <= at) low = middle;
        else high = middle - 1;
      }
      const parts: Hit["parts"] = [];
      for (let item = low; item < starts.length && starts[item] < end; item++) {
        const itemEnd = item + 1 < starts.length ? starts[item + 1] : lower.length;
        parts.push({ item, from: Math.max(at, starts[item]) - starts[item], to: Math.min(end, itemEnd) - starts[item] });
      }
      hits.push({ page, parts });
    }
  });
  return hits;
}

/** Wraps the matched text of a page's text layer in <mark>; the active match gets data-current. */
function highlight(container: HTMLElement, divs: HTMLElement[], hits: Hit[], active: number) {
  const marked = new Set<HTMLElement>();
  container.querySelectorAll("mark").forEach((mark) => marked.add(mark.parentElement!));
  marked.forEach((div) => void (div.textContent = div.textContent));
  const byItem = new Map<number, { from: number; to: number; current: boolean }[]>();
  hits.forEach((hit, index) => {
    for (const { item, from, to } of hit.parts) {
      const list = byItem.get(item) ?? [];
      list.push({ from, to, current: index === active });
      byItem.set(item, list);
    }
  });
  byItem.forEach((ranges, item) => {
    const div = divs[item];
    if (!div) return;
    const text = div.textContent ?? "";
    const nodes: (string | HTMLElement)[] = [];
    let position = 0;
    for (const { from, to, current } of ranges) {
      const end = Math.min(to, text.length);
      if (end <= from || from < position) continue;
      const mark = document.createElement("mark");
      mark.textContent = text.slice(from, end);
      if (current) mark.dataset.current = "";
      nodes.push(text.slice(position, from), mark);
      position = end;
    }
    nodes.push(text.slice(position));
    div.replaceChildren(...nodes);
  });
}

type PageProps = {
  lib: Library;
  doc: PDFDocumentProxy;
  index: number;
  width: number;
  height: number;
  /** CSS pixels per PDF point. */
  scale: number;
  viewport: RefObject<HTMLDivElement | null>;
  hits: Hit[] | undefined;
  /** Position of the current match among this page's hits, or -1. */
  active: number;
  /** Changes with every step to a match, so the page scrolls to it once. */
  nonce: number;
};

/** One page: an empty white sheet until it is near the viewport, then a canvas with a text layer over it. */
const PdfPage = memo(function PdfPage({ lib, doc, index, width, height, scale, viewport, hits, active, nonce }: PageProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const textHost = useRef<HTMLDivElement>(null);
  const text = useRef<{ container: HTMLElement; layer: TextLayer } | null>(null);
  const revealed = useRef(0);
  const [near, setNear] = useState(false);
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => setNear(entries[entries.length - 1].isIntersecting), { root: viewport.current, rootMargin: "100% 0px" });
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, [viewport]);

  useEffect(() => {
    const canvases = canvasHost.current!;
    const texts = textHost.current!;
    const release = () => canvases.querySelectorAll("canvas").forEach((canvas) => void (canvas.width = 0));
    if (!near) {
      release();
      canvases.replaceChildren();
      texts.replaceChildren();
      text.current = null;
      return;
    }
    let cancelled = false;
    let render: RenderTask | undefined;
    let layer: TextLayer | undefined;
    void (async () => {
      const page = await doc.getPage(index + 1);
      if (cancelled) return;
      const css = page.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PIXELS / (css.width * css.height)));
      const pixels = page.getViewport({ scale: scale * ratio });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(pixels.width);
      canvas.height = Math.floor(pixels.height);
      render = page.render({ canvas, viewport: pixels });
      const container = document.createElement("div");
      container.className = TEXT_LAYER;
      container.style.setProperty("--total-scale-factor", String(scale));
      container.style.setProperty("--text-scale-factor", "calc(var(--total-scale-factor) * var(--min-font-size))");
      container.style.setProperty("--min-font-size-inv", "calc(1 / var(--min-font-size))");
      container.style.setProperty("--scale-round-x", "1px");
      container.style.setProperty("--scale-round-y", "1px");
      layer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container, viewport: css });
      await Promise.all([render.promise, layer.render()]);
      if (cancelled) return;
      release();
      canvases.replaceChildren(canvas);
      texts.replaceChildren(container);
      text.current = { container, layer };
      setDrawn((count) => count + 1);
    })().catch(() => {});
    return () => {
      cancelled = true;
      render?.cancel();
      layer?.cancel();
    };
  }, [near, lib, doc, index, scale]);

  useEffect(() => {
    const drawing = text.current;
    if (!drawing) return;
    highlight(drawing.container, drawing.layer.textDivs, hits ?? [], active);
    if (active < 0 || revealed.current === nonce) return;
    const mark = drawing.container.querySelector<HTMLElement>("mark[data-current]");
    if (!mark) return;
    revealed.current = nonce;
    const rect = mark.getBoundingClientRect();
    const view = viewport.current!.getBoundingClientRect();
    if (rect.top < view.top || rect.bottom > view.bottom || rect.left < view.left || rect.right > view.right) mark.scrollIntoView({ block: "center", inline: "center" });
  }, [hits, active, nonce, drawn, viewport]);

  return (
    <div ref={box} data-page={index + 1} className="relative shrink-0 bg-white shadow-sm" style={{ width, height }}>
      <div ref={canvasHost} className="absolute inset-0 [&>canvas]:block [&>canvas]:size-full" />
      <div ref={textHost} className="absolute inset-0" />
    </div>
  );
});

function ToolButton({ label, onClick, disabled, pressed, children }: { label: string; onClick(): void; disabled?: boolean; pressed?: boolean; children: ReactNode }) {
  return (
    <span title={label} className="shrink-0"><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" aria-label={label} aria-pressed={pressed} onClick={onClick} disabled={disabled}>
      {children}
    </Button></span>
  );
}

export function PdfOpener({ path, source }: PluginFileOpenerProps) {
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
  const fileName = path.slice(path.lastIndexOf("/") + 1);

  const [info, setInfo] = useState<Info | null>(null);
  const [pdf, setPdf] = useState<Loaded | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState<{ submit(value: string): void; wrong: boolean } | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [zoom, setZoom] = useState<Zoom>("width");
  const [view, setView] = useState({ w: 0, h: 0 });
  const [current, setCurrent] = useState(0);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [texts, setTexts] = useState<PageText[] | null>(null);
  const [matchIndex, setMatchIndex] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [quotable, setQuotable] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const opened = useRef<PDFDocumentLoadingTask | null>(null);
  const opening = useRef<PDFDocumentLoadingTask | null>(null);
  /** The page in view and how far down it the top of the viewport is, so zooming and late page sizes keep the place. */
  const anchor = useRef({ page: 0, fraction: 0 });
  const selection = useRef<{ text: string; from: number; to: number } | null>(null);

  const load = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    setError(null);
    setPassword(null);
    void opening.current?.destroy();
    try {
      const file = await rpc.call("open", request);
      const response = await fetch(`${file.url}${file.url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? t("fileMissing", { path: file.absPath }) : `HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const sizeBytes = bytes.byteLength;
      const lib = await loadLibrary();
      if (run !== generation.current) return;
      const task = lib.getDocument({ data: bytes });
      opening.current = task;
      task.onPassword = (submit: (value: string) => void, reason: number) => {
        if (run === generation.current) setPassword({ submit, wrong: reason === lib.PasswordResponses.INCORRECT_PASSWORD });
      };
      const doc = await task.promise;
      if (run !== generation.current) return;
      const first = (await doc.getPage(1)).getViewport({ scale: 1 });
      void opened.current?.destroy();
      opened.current = task;
      setPassword(null);
      setSizes(Array.from({ length: doc.numPages }, () => ({ w: first.width, h: first.height })));
      setPdf({ lib, doc });
      setInfo({ hostName: file.hostName, absPath: file.absPath, sizeBytes });
      setTexts(null);
      // Pages may differ in size: the rest are measured in the background and the layout settles as they arrive.
      for (let start = 1; start < doc.numPages; start += CHUNK) {
        const count = Math.min(CHUNK, doc.numPages - start);
        const chunk = await Promise.all(
          Array.from({ length: count }, async (_, offset) => {
            const size = (await doc.getPage(start + offset + 1)).getViewport({ scale: 1 });
            return { w: size.width, h: size.height };
          }),
        );
        if (run !== generation.current) return;
        setSizes((previous) => {
          const next = previous.slice();
          next.splice(start, count, ...chunk);
          return next;
        });
      }
    } catch (cause) {
      if (run === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, [rpc, request]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    generation.current++;
    void opening.current?.destroy();
    void opened.current?.destroy();
  }, []);

  useLayoutEffect(() => {
    const element = viewport.current!;
    const measure = () => setView({ w: element.clientWidth, h: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const first = sizes[0];
  const fitWidth = first && view.w ? (view.w - 2 * PAD) / first.w : 0;
  const fitScale = zoom === "width" ? fitWidth : zoom === "page" ? Math.min(fitWidth, first && view.h ? (view.h - 2 * PAD) / first.h : 0) : zoom * CSS_UNITS;
  const scale = fitScale ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale)) : 0;
  const factor = scale / CSS_UNITS;

  /** Top of every page inside the scrolled content. */
  const offsets = useMemo(() => {
    let top = PAD;
    return sizes.map((size) => {
      const at = top;
      top += size.h * scale + PAD;
      return at;
    });
  }, [sizes, scale]);

  useLayoutEffect(() => {
    const element = viewport.current!;
    if (!scale || !offsets.length) return;
    const page = Math.min(anchor.current.page, offsets.length - 1);
    element.scrollTop = offsets[page] - PAD + anchor.current.fraction * sizes[page].h * scale;
    // A page wider than the rest widens the content: keep the narrower ones in view.
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, [offsets]);

  const goTo = (page: number) => {
    const index = Math.min(Math.max(page, 0), offsets.length - 1);
    if (viewport.current) viewport.current.scrollTop = offsets[index] - PAD;
  };

  const onScroll = () => {
    const element = viewport.current!;
    if (!offsets.length) return;
    const { scrollTop, clientHeight } = element;
    let low = 0;
    let high = offsets.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (offsets[middle] + sizes[middle].h * scale > scrollTop) high = middle;
      else low = middle + 1;
    }
    // The page with the most of it on screen is the current one; at the very end, the last page.
    let page = low;
    let best = -1;
    for (let index = low; index < offsets.length && offsets[index] < scrollTop + clientHeight; index++) {
      const shown = Math.min(offsets[index] + sizes[index].h * scale, scrollTop + clientHeight) - Math.max(offsets[index], scrollTop);
      if (shown > best) {
        page = index;
        best = shown;
      }
    }
    if (scrollTop + clientHeight >= element.scrollHeight - 2) page = offsets.length - 1;
    anchor.current = { page, fraction: (scrollTop - (offsets[page] - PAD)) / (sizes[page].h * scale) };
    setCurrent(page);
  };

  const zoomBy = (direction: 1 | -1) => {
    const next = direction > 0 ? ZOOM_STEPS.find((step) => step > factor + 0.01) : [...ZOOM_STEPS].reverse().find((step) => step < factor - 0.01);
    if (next) setZoom(next);
  };

  const needle = query.trim() ? query.toLowerCase() : "";
  const searching = needle !== "";

  useEffect(() => {
    if (!pdf || !searching || texts) return;
    let cancelled = false;
    void (async () => {
      const all: PageText[] = [];
      for (let start = 0; start < pdf.doc.numPages; start += CHUNK) {
        const count = Math.min(CHUNK, pdf.doc.numPages - start);
        all.push(...(await Promise.all(Array.from({ length: count }, (_, offset) => pageText(pdf.doc, start + offset)))));
        if (cancelled) return;
      }
      setTexts(all);
    })().catch(() => setTexts([]));
    return () => {
      cancelled = true;
    };
  }, [pdf, searching, texts]);

  const hits = useMemo(() => (texts && needle ? findHits(texts, needle) : []), [texts, needle]);
  const hitsByPage = useMemo(() => {
    const pages = new Map<number, Hit[]>();
    for (const hit of hits) {
      const list = pages.get(hit.page) ?? [];
      list.push(hit);
      pages.set(hit.page, list);
    }
    return pages;
  }, [hits]);
  const activeHit = hits[matchIndex];

  const reveal = (index: number) => {
    const hit = hits[index];
    if (!hit) return;
    setMatchIndex(index);
    setNonce((count) => count + 1);
    const element = viewport.current!;
    // A page already on screen scrolls to the match itself; a far one is brought into view first.
    if (offsets[hit.page] > element.scrollTop + element.clientHeight || offsets[hit.page] + sizes[hit.page].h * scale < element.scrollTop) goTo(hit.page);
  };

  useEffect(() => {
    if (hits.length) reveal(Math.max(0, hits.findIndex((hit) => hit.page >= anchor.current.page)));
    else setMatchIndex(0);
  }, [hits]);

  const step = (direction: 1 | -1) => {
    if (hits.length) reveal((matchIndex + direction + hits.length) % hits.length);
  };

  useEffect(() => {
    const pageOf = (node: Node | null) => Number((node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-page]")?.dataset.page) || null;
    const onChange = () => {
      const selected = document.getSelection();
      if (!selected || !viewport.current?.contains(selected.anchorNode)) return;
      const text = selected.isCollapsed ? "" : selected.toString();
      const here = anchor.current.page + 1;
      const pages = [pageOf(selected.anchorNode) ?? here, pageOf(selected.focusNode) ?? here];
      selection.current = text.trim() ? { text, from: Math.min(...pages), to: Math.max(...pages) } : null;
      setQuotable(selection.current !== null);
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  const quote = () => {
    const picked = selection.current;
    if (!picked || !info) return;
    const lines = picked.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const where = picked.from === picked.to ? t("pageRef", { n: picked.from }) : t("pagesRef", { from: picked.from, to: picked.to });
    const block = [`\`${info.absPath}\` · ${where} · ${info.hostName}`, "", ...lines.map((line) => `> ${line}`)].join("\n");
    composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${block}\n\n`);
    composer.focus();
    toast.success(t("quoted"));
  };

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
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      void download();
    } else if (key === "f") {
      event.preventDefault();
      searchInput.current?.focus();
      searchInput.current?.select();
    } else if (key === "=" || key === "+") {
      event.preventDefault();
      zoomBy(1);
    } else if (key === "-") {
      event.preventDefault();
      zoomBy(-1);
    } else if (key === "0") {
      event.preventDefault();
      setZoom("width");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background outline-none" onKeyDown={onKeyDown}>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-border px-2 py-1">
        <div className="min-w-0 flex-1 basis-40 px-1">
          <div className="truncate text-sm font-medium" title={info?.absPath ?? path}>{fileName}</div>
          {info ? <div className="truncate text-xs text-muted-foreground">{info.hostName} · {formatSize(info.sizeBytes)}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {pdf ? (
            <>
              <Input
                inputMode="numeric"
                value={pageDraft ?? String(current + 1)}
                aria-label={t("pageNumber")}
                className="h-7 w-11 px-1 text-center text-xs tabular-nums"
                onChange={(event) => setPageDraft(event.target.value)}
                onFocus={(event) => event.target.select()}
                onBlur={() => setPageDraft(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    const page = parseInt(event.currentTarget.value, 10);
                    if (page) goTo(page - 1);
                    setPageDraft(null);
                    viewport.current?.focus();
                  } else if (event.key === "Escape") {
                    setPageDraft(null);
                    viewport.current?.focus();
                  }
                }}
              />
              <span className="shrink-0 pr-1 text-xs tabular-nums text-muted-foreground">/ {sizes.length}</span>
              <ToolButton label={t("zoomOut")} onClick={() => zoomBy(-1)} disabled={factor <= ZOOM_STEPS[0] + 0.01}><Icon name="ZoomOut" className="size-4" /></ToolButton>
              <span className="w-9 shrink-0 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">{Math.round(factor * 100)}%</span>
              <ToolButton label={t("zoomIn")} onClick={() => zoomBy(1)} disabled={factor >= ZOOM_STEPS[ZOOM_STEPS.length - 1] - 0.01}><Icon name="ZoomIn" className="size-4" /></ToolButton>
              <ToolButton label={t("fitWidth")} onClick={() => setZoom("width")} pressed={zoom === "width"}><Icon name="ArrowUpDown" className="size-4 rotate-90" /></ToolButton>
              <ToolButton label={t("fitPage")} onClick={() => setZoom("page")} pressed={zoom === "page"}><Icon name="Maximize2" className="size-4" /></ToolButton>
              <div className="relative flex shrink items-center">
                <Icon name="Search" className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
                <Input
                  ref={searchInput}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      step(event.shiftKey ? -1 : 1);
                    } else if (event.key === "Escape") {
                      setQuery("");
                      viewport.current?.focus();
                    }
                  }}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchDocument")}
                  title={t("searchDocument")}
                  className="h-7 w-36 min-w-24 pl-7 text-xs"
                />
              </div>
              {searching ? (
                <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">
                  {!texts ? t("searching") : hits.length ? t("matchOf", { i: matchIndex + 1, n: hits.length }) : t("noMatches")}
                </span>
              ) : null}
              {hits.length > 1 ? (
                <>
                  <ToolButton label={t("previousMatch")} onClick={() => step(-1)}><Icon name="ChevronUp" className="size-4" /></ToolButton>
                  <ToolButton label={t("nextMatch")} onClick={() => step(1)}><Icon name="ChevronDown" className="size-4" /></ToolButton>
                </>
              ) : null}
              <span title={quotable ? t("quote") : t("selectToQuote")} className="shrink-0">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5" onMouseDown={(event) => event.preventDefault()} onClick={quote} disabled={!quotable}>
                  <Icon name="MessageSquarePlus" className="size-4" /> <span className="hidden sm:inline">{t("quote")}</span>
                </Button>
              </span>
            </>
          ) : null}
          <span title={t("downloadHint")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void download()} disabled={!info}>
            <Icon name="Download" className="size-4" /> <span className="hidden sm:inline">{t("download")}</span>
          </Button></span>
          <span title={t("refresh")} className="shrink-0"><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => void load()} disabled={loading && !password} aria-label={t("refresh")}>
            <Icon name={loading && !password ? "Spinner" : "ArrowReloadHorizontal"} className={loading && !password ? "size-4 animate-spin" : "size-4"} />
          </Button></span>
        </div>
      </div>

      <div ref={viewport} tabIndex={0} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto bg-muted/30 outline-none [overflow-anchor:none]">
        {error ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
            <span className="font-medium">{t("openFailed")}</span>
            <span className="max-w-lg break-words text-muted-foreground">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>{t("retry")}</Button>
          </div>
        ) : password ? (
          <form
            className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm"
            onSubmit={(event) => {
              event.preventDefault();
              password.submit(passwordDraft);
              setPasswordDraft("");
              setPassword(null);
            }}
          >
            <Icon name="Lock" className="size-6 text-muted-foreground" />
            <span className="font-medium">{t("passwordRequired")}</span>
            {password.wrong ? <span role="alert" className="text-destructive">{t("passwordWrong")}</span> : null}
            <div className="flex w-full max-w-xs gap-2">
              <Input type="password" autoFocus value={passwordDraft} onChange={(event) => setPasswordDraft(event.target.value)} placeholder={t("password")} aria-label={t("password")} className="h-9" />
              <Button type="submit" size="sm" className="h-9">{t("unlock")}</Button>
            </div>
          </form>
        ) : !pdf ? (
          <div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>
        ) : scale ? (
          <div className="flex w-max min-w-full flex-col items-center gap-2 p-2">
            {sizes.map((size, index) => {
              const pageHits = hitsByPage.get(index);
              const isActive = activeHit?.page === index;
              return (
                <PdfPage
                  key={index}
                  lib={pdf.lib}
                  doc={pdf.doc}
                  index={index}
                  width={size.w * scale}
                  height={size.h * scale}
                  scale={scale}
                  viewport={viewport}
                  hits={pageHits}
                  active={isActive ? pageHits!.indexOf(activeHit!) : -1}
                  nonce={isActive ? nonce : 0}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
