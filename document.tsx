// Office Viewer — Word opener. .docx pages are laid out in the browser by
// docx-preview; a legacy binary .doc has no browser renderer, so the server
// extracts its text and the viewer shows that. Both can be searched, zoomed
// and quoted into the chat.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useComposer, useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { renderAsync } from "docx-preview";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { detectLocale, t } from "./i18n";
import { formatSize } from "./media";
import { formatBlockquote } from "./quote";
import { extensionOf } from "./sheet";

const LEGACY_EXTENSIONS = ["doc", "dot"];
export const WORD_EXTENSIONS = ["docx", "docm", "dotx", ...LEGACY_EXTENSIONS];

/** Word draws bullets with Symbol/Wingdings glyphs from the Private Use Area; browsers without those fonts show boxes. */
const BULLETS: Record<string, string> = { "": "•", "": "▪", "": "□", "": "❖", "": "➢", "": "✓", "": "→" };
const BULLET_PATTERN = new RegExp(`[${Object.keys(BULLETS).join("")}]`, "g");

/** Search hits are painted with the CSS Custom Highlight API, so the document's own markup stays untouched. */
const HIGHLIGHT = "office-find";
const HIGHLIGHT_CURRENT = "office-find-current";
const HIGHLIGHT_CSS = `::highlight(${HIGHLIGHT}){background-color:#fde68a;color:#000}::highlight(${HIGHLIGHT_CURRENT}){background-color:#f59e0b;color:#000}`;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
/** The browser's highlight registry (typed as a Map: the DOM typings leave out its methods), or null where unsupported. */
const highlightRegistry = () => (typeof CSS !== "undefined" && "highlights" in CSS ? (CSS.highlights as unknown as Map<string, Highlight>) : null);
const BLOCKS = "p,li,td,th,h1,h2,h3,h4,h5,h6,div,article,section";

/** "auto" keeps the page at its size unless the panel is narrower; "width" fills the panel; a number is a fixed scale. */
type Zoom = "auto" | "width" | number;
type Info = { hostName: string; absPath: string; sizeBytes: number };
type LegacyText = { body: string; headers: string; footnotes: string; endnotes: string };

/** Every case-insensitive occurrence of `needle` in the text under `root`. Runs of one paragraph are searched together, because Word splits its text by formatting. */
function findRanges(root: Node, needle: string): Range[] {
  const lower = needle.toLowerCase();
  const found: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let group: { node: Text; start: number }[] = [];
  let block: Element | null = null;
  let text = "";
  const flush = () => {
    const haystack = text.toLowerCase();
    const locate = (offset: number, end: boolean) => {
      const item = [...group].reverse().find((entry) => (end ? entry.start < offset : entry.start <= offset)) ?? group[0];
      return { node: item.node, offset: offset - item.start };
    };
    for (let at = haystack.indexOf(lower); at !== -1; at = haystack.indexOf(lower, at + lower.length)) {
      const from = locate(at, false);
      const to = locate(at + lower.length, true);
      const range = document.createRange();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      found.push(range);
    }
    group = [];
    text = "";
  };
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest("style,script")) continue;
    const owner = parent.closest(BLOCKS);
    if (owner !== block) {
      flush();
      block = owner;
    }
    group.push({ node: node as Text, start: text.length });
    text += node.nodeValue ?? "";
  }
  flush();
  return found;
}

export function DocumentOpener({ path, source }: PluginFileOpenerProps) {
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

  const [info, setInfo] = useState<Info | null>(null);
  const [text, setText] = useState<LegacyText | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoomMode] = useState<Zoom>("auto");
  const [scale, setScale] = useState(1);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Range[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  /** The query the current matches belong to; the counter waits for it so typing doesn't flash "No matches". */
  const [searched, setSearched] = useState("");
  const [selected, setSelected] = useState("");
  const finder = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const styles = useRef<HTMLDivElement>(null);
  const plain = useRef<HTMLDivElement>(null);
  const pageWidth = useRef(0);
  const zoomMode = useRef<Zoom>("auto");
  const generation = useRef(0);

  /** Scales the pages (or the plain text): by default down to the panel width, so a phone shows a whole page instead of scrolling sideways. */
  const fit = useCallback(() => {
    const target = (plain.current ?? pages.current?.firstElementChild) as HTMLElement | null;
    if (!target || !viewport.current) return;
    const natural = pageWidth.current ? viewport.current.clientWidth / pageWidth.current : 1;
    const mode = zoomMode.current;
    const next = typeof mode === "number" ? mode : mode === "width" ? Math.min(4, natural) : Math.min(1, natural);
    target.style.setProperty("zoom", String(next));
    // Word centres its pages: without a minimum width the left part of a page zoomed past the panel can't be scrolled to.
    target.style.setProperty("min-width", pageWidth.current ? "max-content" : "");
    setScale(next);
  }, []);

  const setZoom = (mode: Zoom) => {
    zoomMode.current = mode;
    setZoomMode(mode);
    fit();
  };

  const stepZoom = (direction: 1 | -1) => {
    const next = direction > 0 ? ZOOM_STEPS.find((step) => step > scale + 0.005) : [...ZOOM_STEPS].reverse().find((step) => step < scale - 0.005);
    if (next) setZoom(next);
  };

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

  // The plain text of a .doc appears after the first render, so it is scaled once it exists.
  useLayoutEffect(() => fit(), [fit, text]);

  // Search: find the hits once typing pauses (and again when the document is reloaded).
  useEffect(() => {
    const container = plain.current ?? pages.current;
    if (!container || !info || !query.trim()) {
      setMatches([]);
      setSearched("");
      return;
    }
    const timer = setTimeout(() => {
      setMatches(findRanges(container, query));
      setMatchIndex(0);
      setSearched(query);
    }, 120);
    return () => clearTimeout(timer);
  }, [query, info, text]);

  // Paint the hits and bring the current one to the middle of the panel.
  useEffect(() => {
    const current = matches[matchIndex];
    const registry = highlightRegistry();
    if (registry && matches.length) {
      registry.set(HIGHLIGHT, new Highlight(...matches));
      if (current) {
        const mark = new Highlight(current);
        mark.priority = 1;
        registry.set(HIGHLIGHT_CURRENT, mark);
      }
    }
    if (current && viewport.current) {
      const box = current.getBoundingClientRect();
      const panel = viewport.current.getBoundingClientRect();
      viewport.current.scrollBy({ top: box.top - panel.top - panel.height / 2, left: box.left - panel.left - panel.width / 2 });
    }
    return () => {
      registry?.delete(HIGHLIGHT);
      registry?.delete(HIGHLIGHT_CURRENT);
    };
  }, [matches, matchIndex]);

  const step = (direction: 1 | -1) => {
    if (matches.length) setMatchIndex((matchIndex + direction + matches.length) % matches.length);
  };

  // The selection inside the document is what "Quote in chat" sends.
  useEffect(() => {
    const onChange = () => {
      const selection = document.getSelection();
      const inside = !!selection && !selection.isCollapsed && !!viewport.current?.contains(selection.anchorNode) && !!viewport.current?.contains(selection.focusNode);
      setSelected(inside ? selection.toString().trim() : "");
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

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
    if (!info || !selected) return;
    const block = formatBlockquote({ path: info.absPath, host: info.hostName, text: selected });
    composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${block}\n\n`);
    composer.focus();
    toast.success(t("quoted"));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      void download();
    } else if (key === "f") {
      event.preventDefault();
      finder.current?.focus();
      finder.current?.select();
    } else if (key === "+" || key === "=") {
      event.preventDefault();
      stepZoom(1);
    } else if (key === "-" || key === "_") {
      event.preventDefault();
      stepZoom(-1);
    } else if (key === "0") {
      event.preventDefault();
      setZoom("auto");
    }
  };

  const extra = text ? [text.headers, text.footnotes, text.endnotes].map((part) => part.trim()).filter(Boolean) : [];
  const ready = !!info && !error;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <style>{HIGHLIGHT_CSS}</style>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-sm font-medium" title={info?.absPath ?? path}>{fileName}</div>
          {info ? <div className="truncate text-xs text-muted-foreground">{info.hostName} · {formatSize(info.sizeBytes)}</div> : null}
        </div>
        <div className="relative flex shrink items-center">
          <Icon name="Search" className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
          <Input
            ref={finder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              } else if (event.key === "Escape") {
                setQuery("");
                event.currentTarget.blur();
              }
            }}
            placeholder={t("findInDocument")}
            aria-label={t("findInDocument")}
            disabled={!ready}
            className="h-7 w-44 min-w-24 pl-7 text-xs"
          />
        </div>
        {query.trim() && searched === query && ready ? (
          <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {matches.length ? t("matchOf", { i: matchIndex + 1, n: matches.length }) : t("noMatches")}
          </span>
        ) : null}
        {matches.length > 1 ? (
          <>
            <span title={t("previousMatch")} className="shrink-0"><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => step(-1)} aria-label={t("previousMatch")}><Icon name="ChevronUp" className="size-4" /></Button></span>
            <span title={t("nextMatch")} className="shrink-0"><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => step(1)} aria-label={t("nextMatch")}><Icon name="ChevronDown" className="size-4" /></Button></span>
          </>
        ) : null}
        <div className="flex shrink-0 items-center">
          <span title={t("docZoomOut")}><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => stepZoom(-1)} disabled={!ready} aria-label={t("docZoomOut")}><Icon name="ZoomOut" className="size-4" /></Button></span>
          <span title={t("docZoomFit")}><Button variant="ghost" size="sm" className={cn("h-7 min-w-12 px-1 text-xs tabular-nums", zoom === "width" ? "text-foreground" : "text-muted-foreground")} onClick={() => setZoom(zoom === "width" ? "auto" : "width")} disabled={!ready} aria-pressed={zoom === "width"} aria-label={t("docZoomFit")}>{Math.round(scale * 100)}%</Button></span>
          <span title={t("docZoomIn")}><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => stepZoom(1)} disabled={!ready} aria-label={t("docZoomIn")}><Icon name="ZoomIn" className="size-4" /></Button></span>
        </div>
        <span title={selected ? t("quoteSelection") : t("selectToQuote")} className="shrink-0"><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onMouseDown={(event) => event.preventDefault()} onClick={quote} disabled={!selected} aria-label={t("quote")}>
          <Icon name="MessageSquarePlus" className="size-4" />
        </Button></span>
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

      <ContextMenu>
        <ContextMenuTrigger asChild>
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
                <div ref={plain} className="mx-auto max-w-3xl p-3">
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52" data-bb-ru-skip="" onCloseAutoFocus={(event) => event.preventDefault()}>
          <ContextMenuItem disabled={!selected} onSelect={quote}>
            <Icon name="MessageSquarePlus" className="size-4" /> {t("quote")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
