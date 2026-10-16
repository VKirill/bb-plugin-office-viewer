// Office Viewer — HTML layout viewer. The page runs in sandboxed iframes sized
// like real screens (phones, tablets, monitors or a custom size, in portrait or
// landscape) and scaled down to fit the panel; several devices can stand side by
// side. The plugin server serves the file's folder, so relative CSS, scripts and
// images load. BB's own preview with the source stays one click away.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { useComposer, useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowReloadHorizontalIcon,
  Camera01Icon,
  FullScreenIcon,
  LaptopIcon,
  LayoutTwoColumnIcon,
  Loading03Icon,
  Link01Icon,
  MinimizeScreenIcon,
  RotateClockwiseIcon,
  RulerIcon,
  SmartPhone01Icon,
  SourceCodeIcon,
  Tablet01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import type { rpcContract } from "../../server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { detectLocale, t } from "../shared/i18n";
import type { domToBlob } from "modern-screenshot";
import { decodeHtml, insideSite, prepareHtml, SCREENSHOT_LIBRARY } from "./capture";
import { BREAKPOINTS, clampSide, DEVICES, deviceById, fitGrid, MAIN_DEVICES, mockup, turned, type Device, type DeviceKind, type Hardware as HardwareKind, type Mockup, type Size } from "./devices";

export const HTML_EXTENSIONS = ["html", "htm"];

/** Room around the frames and between them, in pixels. */
const PAD = 16;
const GAP = 24;
const LABEL = 38;
/** Narrowest a device column gets, so its caption stays readable. */
const CAPTION_MIN = 120;
const RULER = 26;
const ZOOMS = [0.25, 0.5, 0.75, 1];
const STORAGE = "office-viewer:html-layout";
const SANDBOX = "allow-scripts allow-forms allow-popups allow-modals";
const KIND_ICON: Record<DeviceKind | "custom", IconSvgElement> = { phone: SmartPhone01Icon, tablet: Tablet01Icon, desktop: LaptopIcon, custom: RulerIcon };

type Layout = {
  mode: "single" | "compare";
  /** A preset id or "custom". */
  device: string;
  custom: Size;
  /** Every preset turned from how it naturally stands. */
  rotated: boolean;
  zoom: "fit" | number;
  ruler: boolean;
  compare: string[];
};

const DEFAULT_LAYOUT: Layout = {
  mode: "single",
  device: "full-hd",
  custom: { w: 768, h: 1024 },
  rotated: false,
  zoom: "fit",
  ruler: false,
  compare: MAIN_DEVICES,
};

/** The viewer remembers its setup across files and sessions. */
function useLayout() {
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      return validLayout(JSON.parse(localStorage.getItem(STORAGE) ?? "null") as Partial<Layout> | null);
    } catch {
      return DEFAULT_LAYOUT;
    }
  });
  const update = useCallback((patch: Partial<Layout>) => {
    setLayout((previous) => {
      const next = { ...previous, ...patch };
      try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* private mode: the setup lives for this tab */ }
      return next;
    });
  }, []);
  return [layout, update] as const;
}

function useSize(ref: RefObject<HTMLElement | null>, enabled: boolean): Size {
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const measure = () => setSize({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return size;
}

type Screen = { key: string; name: string; kind: DeviceKind | "custom"; hardware: HardwareKind; share?: number; size: Size; mock: Mockup };

function screenOf(device: Device | null, layout: Layout): Screen {
  if (!device) return { key: "custom", name: t("htmlCustom"), kind: "custom", hardware: "none", size: layout.custom, mock: mockup("none", layout.custom) };
  const size = turned({ w: device.width, h: device.height }, layout.rotated && device.kind !== "desktop");
  return { key: device.id, name: device.name, kind: device.kind, hardware: device.hardware, share: device.share, size, mock: mockup(device.hardware, size) };
}

/** A saved setup may name presets that no longer exist. */
function validLayout(saved: Partial<Layout> | null): Layout {
  const layout = { ...DEFAULT_LAYOUT, ...saved };
  if (layout.device !== "custom" && !deviceById(layout.device)) layout.device = DEFAULT_LAYOUT.device;
  layout.compare = layout.compare.filter((id) => deviceById(id));
  if (!layout.compare.length) layout.compare = DEFAULT_LAYOUT.compare;
  return layout;
}

function ToolButton({ label, onClick, disabled, pressed, icon, children }: { label: string; onClick(): void; disabled?: boolean; pressed?: boolean; icon: IconSvgElement; children?: ReactNode }) {
  return (
    <span title={label} className="shrink-0">
      <Button variant="ghost" size={children ? "sm" : "icon"} className={cn(children ? "h-8 gap-1.5" : "size-8", "text-muted-foreground hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground")} aria-label={label} aria-pressed={pressed} onClick={onClick} disabled={disabled}>
        <HugeiconsIcon icon={icon} size={16} />
        {children}
      </Button>
    </span>
  );
}

const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Signal, Wi-Fi and battery, as on a phone's status bar. */
function StatusIcons({ height }: { height: number }) {
  return (
    <svg height={height} viewBox="0 0 68 12" fill="currentColor" aria-hidden>
      <rect x="0" y="8" width="3" height="4" rx="0.7" />
      <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.7" />
      <rect x="9" y="3" width="3" height="9" rx="0.7" />
      <rect x="13.5" y="0.5" width="3" height="11.5" rx="0.7" />
      <path d="M30 2.2a10.6 10.6 0 0 1 7.6 3.1l1.2-1.2A12.3 12.3 0 0 0 30 .5a12.3 12.3 0 0 0-8.8 3.6l1.2 1.2A10.6 10.6 0 0 1 30 2.2Zm0 3.6a6.8 6.8 0 0 1 4.9 2l1.2-1.2A8.5 8.5 0 0 0 30 4.1a8.5 8.5 0 0 0-6.1 2.5l1.2 1.2a6.8 6.8 0 0 1 4.9-2Zm0 3.6a3 3 0 0 0-2.4 1.1L30 12.9l2.4-2.4A3 3 0 0 0 30 9.4Z" />
      <rect x="42.5" y="1" width="21" height="10" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="44.5" y="3" width="15" height="6" rx="1.6" />
      <path d="M65 4.2v3.6a1.9 1.9 0 0 0 0-3.6Z" fillOpacity="0.45" />
    </svg>
  );
}

/** The parts of the screen that aren't the page: status bar, camera cut-out, home indicator, browser and OS bars. */
function SystemBars({ screen, title, address }: { screen: Screen; title: string; address: string }) {
  const { bars, screen: size } = screen.mock;
  const landscape = size.w > size.h;
  const font = { fontFamily: SYSTEM_FONT };
  switch (screen.hardware) {
    case "island":
    case "notch": {
      const island = screen.hardware === "island";
      const cutout = island
        ? landscape
          ? { left: 11, top: (size.h - 126) / 2, width: 37, height: 126, borderRadius: 20 }
          : { left: (size.w - 126) / 2, top: 11, width: 126, height: 37, borderRadius: 20 }
        : landscape
          ? { left: 0, top: (size.h - 162) / 2, width: 32, height: 162, borderRadius: "0 22px 22px 0" }
          : { left: (size.w - 162) / 2, top: 0, width: 162, height: 32, borderRadius: "0 0 22px 22px" };
      return (
        <>
          <div className="absolute bg-black" style={cutout} />
          {landscape ? null : (
            <div className="absolute inset-x-0 top-0 flex items-center justify-between text-black" style={{ ...font, height: bars.top, padding: `${island ? 6 : 2}px 30px 0 46px` }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>9:41</span>
              <StatusIcons height={12} />
            </div>
          )}
          <div className="absolute rounded-full bg-black" style={{ width: landscape ? 200 : 134, height: 5, bottom: 8, left: (size.w - (landscape ? 200 : 134)) / 2 }} />
        </>
      );
    }
    case "punch-hole":
      return (
        <>
          <div className="absolute flex items-center justify-between text-black" style={{ ...font, left: 0, right: 0, top: 0, height: landscape ? bars.top : bars.top, padding: "0 18px", fontSize: 13, fontWeight: 500 }}>
            <span>12:30</span>
            <StatusIcons height={11} />
          </div>
          <div className="absolute rounded-full bg-black" style={landscape ? { width: 13, height: 13, left: 10, top: (size.h - 13) / 2 } : { width: 13, height: 13, top: 10, left: (size.w - 13) / 2 }} />
          {landscape ? null : <div className="absolute rounded-full bg-black/80" style={{ width: 108, height: 4, bottom: 6, left: (size.w - 108) / 2 }} />}
        </>
      );
    case "home-button":
    case "tablet":
      return (
        <>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between text-black" style={{ ...font, height: bars.top, padding: "0 20px", fontSize: 12, fontWeight: 600 }}>
            <span>9:41</span>
            <StatusIcons height={10} />
          </div>
          {screen.hardware === "tablet" ? <div className="absolute rounded-full bg-black" style={{ width: 300, height: 5, bottom: 7, left: (size.w - 300) / 2 }} /> : null}
        </>
      );
    case "mac-laptop":
    case "pc-laptop":
    case "monitor": {
      const mac = screen.hardware === "mac-laptop";
      const browserTop = mac ? 33 : 0;
      return (
        <>
          {mac ? (
            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-neutral-100 text-black" style={{ ...font, height: 33, padding: "0 16px", fontSize: 13 }}>
              <span className="flex items-center gap-5"><svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden><path d="M11.6 8.5c0-2 1.7-3 1.8-3-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.2.8-.6 0-1.6-.7-2.7-.7C3.1 4 1.8 4.8 1 6.1c-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7c1.2 0 1.9-1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.4s-2.3-.9-2.3-3.8ZM9.5 2.5c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2Z" /></svg><b>Safari</b><span>File</span><span>Edit</span><span>View</span></span>
              <span className="flex items-center gap-3"><StatusIcons height={11} /><span>Thu 9:41</span></span>
            </div>
          ) : null}
          {mac ? <div className="absolute bg-black" style={{ left: (size.w - 200) / 2, top: 0, width: 200, height: 33, borderRadius: "0 0 10px 10px" }} /> : null}
          <div className="absolute inset-x-0 bg-neutral-200" style={{ ...font, top: browserTop, height: 80 }}>
            <div className="flex h-10 items-end gap-2 px-3">
              {mac ? (
                <span className="mb-3.5 flex gap-2">
                  <i className="block size-3 rounded-full bg-[#ff5f57]" /><i className="block size-3 rounded-full bg-[#febc2e]" /><i className="block size-3 rounded-full bg-[#28c840]" />
                </span>
              ) : null}
              <div className="flex h-8 w-60 items-center gap-2 truncate rounded-t-lg bg-white px-3 text-[13px] text-black"><span className="size-3.5 shrink-0 rounded-sm bg-neutral-300" /><span className="truncate">{title}</span></div>
              {mac ? null : <span className="mb-2.5 ml-auto flex gap-6 text-[15px] leading-none text-neutral-700"><span>—</span><span>☐</span><span>✕</span></span>}
            </div>
            <div className="flex h-10 items-center gap-3 bg-white px-3 text-neutral-500">
              <span className="text-lg leading-none">‹</span><span className="text-lg leading-none">›</span><span className="text-[15px] leading-none">↻</span>
              <div className="flex h-7 flex-1 items-center truncate rounded-full bg-neutral-100 px-4 text-[13px] text-neutral-700">{address}</div>
            </div>
          </div>
          {mac ? null : (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-neutral-300 bg-neutral-100/95 text-black" style={{ ...font, height: bars.bottom }}>
              <span className="grid size-7 grid-cols-2 gap-0.5 p-1">{[0, 1, 2, 3].map((i) => <i key={i} className="block bg-sky-500" />)}</span>
              {["bg-neutral-400", "bg-amber-400", "bg-sky-600", "bg-emerald-500"].map((color) => <span key={color} className={cn("size-7 rounded-md", color)} />)}
              <span className="absolute right-4 text-right text-[11px] leading-tight">9:41<br />16.10.2026</span>
            </div>
          )}
        </>
      );
    }
    case "none":
      return null;
  }
}

/** Hardware outside the screen: side buttons, the iPad home button, a laptop deck, a monitor stand. */
function Hardware({ screen }: { screen: Screen }) {
  const { bezel, screen: size, foot, overhang, outer } = screen.mock;
  const landscape = size.w > size.h;
  const caseW = outer.w - 2 * overhang;
  const caseH = outer.h - foot;
  switch (screen.hardware) {
    case "island":
    case "notch":
    case "punch-hole": {
      // Volume on the left and power on the right of an upright phone; turned, they move to the top and bottom.
      const button = (along: number, length: number, side: "a" | "b") =>
        landscape
          ? { left: along, width: length, height: 4, top: side === "a" ? caseH : -4 }
          : { top: along, height: length, width: 4, left: side === "a" ? -4 : caseW };
      const iphone = screen.hardware !== "punch-hole";
      return (
        <>
          {(iphone ? [[150, 30, "a"], [210, 62, "a"], [290, 62, "a"], [240, 100, "b"]] : [[180, 90, "b"], [300, 60, "b"]]).map(([along, length, side]) => (
            <div key={`${along}`} className="absolute rounded-sm bg-neutral-700" style={button(along as number, length as number, side as "a" | "b")} />
          ))}
        </>
      );
    }
    case "home-button":
      return (
        <>
          <div className="absolute rounded-full border-2 border-neutral-600" style={landscape ? { width: 48, height: 48, left: caseW - bezel.right / 2 - 24, top: caseH / 2 - 24 } : { width: 48, height: 48, left: caseW / 2 - 24, top: caseH - bezel.bottom / 2 - 24 }} />
          <div className="absolute rounded-full bg-neutral-600" style={landscape ? { width: 8, height: 8, left: bezel.left / 2 - 4, top: caseH / 2 - 4 } : { width: 8, height: 8, left: caseW / 2 - 4, top: bezel.top / 2 - 4 }} />
        </>
      );
    case "tablet":
      return <div className="absolute rounded-full bg-neutral-600" style={landscape ? { width: 7, height: 7, left: bezel.left / 2 - 3.5, top: caseH / 2 - 3.5 } : { width: 7, height: 7, left: caseW / 2 - 3.5, top: bezel.top / 2 - 3.5 }} />;
    case "mac-laptop":
    case "pc-laptop":
      return (
        <div className="absolute rounded-b-[18px] bg-gradient-to-b from-neutral-300 to-neutral-500" style={{ left: 0, top: caseH, width: outer.w, height: foot }}>
          <div className="mx-auto h-1.5 w-[14%] rounded-b-md bg-neutral-500/70" />
        </div>
      );
    case "monitor":
      return (
        <>
          <div className="absolute bg-gradient-to-r from-neutral-500 via-neutral-400 to-neutral-500" style={{ left: outer.w / 2 - caseW * 0.05, top: caseH, width: caseW * 0.1, height: foot - 16 }} />
          <div className="absolute rounded-md bg-neutral-500" style={{ left: outer.w / 2 - caseW * 0.15, top: outer.h - 16, width: caseW * 0.3, height: 16 }} />
        </>
      );
    case "none":
      return null;
  }
}

/** One device mockup, drawn at `scale`: the page inside lays out at the device's real CSS size. */
function Frame({ screen, scale, doc, shot, frameKey, title, address, ruler, onResize }: {
  screen: Screen;
  scale: number;
  /** The page with the capture agent, as `srcdoc`. */
  doc: string;
  /** While a screenshot is taken: a picture of the page standing in for the frame. */
  shot?: string;
  frameKey: number;
  title: string;
  address: string;
  /** Breakpoint ruler over the page: picks a width. */
  ruler?(width: number): void;
  onResize?(start: Size, scale: number, event: ReactPointerEvent, axis: "x" | "y" | "xy"): void;
}) {
  const { bezel, bars, screen: size, viewport, outer, overhang, radius } = screen.mock;
  const bare = screen.hardware === "none";
  const handle = (axis: "x" | "y" | "xy", className: string) => (
    <div
      title={t("htmlResize")}
      data-shot-skip=""
      className={cn("absolute z-10 flex touch-none items-center justify-center", className)}
      onPointerDown={(event) => onResize?.(screen.size, scale, event, axis)}
    >
      <div className={cn("rounded-full bg-muted-foreground/40 hover:bg-primary", axis === "x" ? "h-8 w-1" : axis === "y" ? "h-1 w-8" : "size-2.5")} />
    </div>
  );
  const pageLeft = overhang + bezel.left + bars.left;
  return (
    <div className="flex shrink-0 flex-col items-center" style={{ width: Math.max(outer.w * scale, CAPTION_MIN) }}>
      <div data-shot-skip="" className="flex w-full shrink-0 flex-col items-center justify-end text-center text-xs leading-4 text-muted-foreground" style={{ height: LABEL }}>
        <span className="flex max-w-full items-center gap-1.5">
          <HugeiconsIcon icon={KIND_ICON[screen.kind]} size={13} className="shrink-0" />
          <span className="truncate font-medium text-foreground">{screen.name}</span>
        </span>
        <span className="max-w-full truncate tabular-nums" title={t("htmlViewportHint")}>
          {size.w}×{size.h}
          {viewport.w !== size.w || viewport.h !== size.h ? ` · ${t("htmlViewport", { w: viewport.w, h: viewport.h })}` : ""}
          {scale < 0.995 ? ` · ${Math.round(scale * 100)}%` : ""}
        </span>
      </div>
      {ruler ? <div data-shot-skip="" className="self-start" style={{ marginLeft: Math.max(0, (CAPTION_MIN - outer.w * scale) / 2) + pageLeft * scale }}><Ruler width={viewport.w} scale={scale} onPick={ruler} /></div> : null}
      <div className="relative" style={{ width: outer.w * scale, height: outer.h * scale }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: outer.w, height: outer.h, transform: `scale(${scale})` }}>
          <Hardware screen={screen} />
          <div
            className={cn("absolute", bare ? "border border-border" : "bg-neutral-900 shadow-[inset_0_0_0_2px_#3f3f46,0_10px_40px_-12px_rgba(0,0,0,0.5)]")}
            style={bare ? { left: -1, top: -1, width: size.w + 2, height: size.h + 2 } : { left: overhang, top: 0, width: size.w + bezel.left + bezel.right, height: size.h + bezel.top + bezel.bottom, borderRadius: radius + Math.min(bezel.left, bezel.top) }}
          />
          <div className="absolute overflow-hidden bg-white" style={{ left: overhang + bezel.left, top: bezel.top, width: size.w, height: size.h, borderRadius: radius }}>
            <iframe
              key={frameKey}
              srcDoc={doc}
              data-shot={screen.key}
              data-shot-skip=""
              title={`${screen.name} ${viewport.w}×${viewport.h}`}
              sandbox={SANDBOX}
              onLoad={(event) => {
                const target = event.currentTarget.contentWindow;
                setTimeout(() => target?.postMessage({ type: "ov-warm" }, "*"), 1000);
              }}
              className="absolute block border-0 bg-white"
              style={{ left: bars.left, top: bars.top, width: viewport.w, height: viewport.h }}
            />
            {shot ? <img data-shot-image="" src={shot} alt="" className="absolute block" style={{ left: bars.left, top: bars.top, width: viewport.w, height: viewport.h }} /> : null}
            <SystemBars screen={screen} title={title} address={address} />
          </div>
        </div>
        {onResize ? (
          <>
            {handle("x", "-right-3 top-0 h-full w-3 cursor-ew-resize")}
            {handle("y", "-bottom-3 left-0 h-3 w-full cursor-ns-resize")}
            {handle("xy", "-bottom-3 -right-3 size-3 cursor-nwse-resize")}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Breakpoint widths above the frame: ticks where they fall inside it, and chips that set the width. */
function Ruler({ width, scale, onPick }: { width: number; scale: number; onPick(width: number): void }) {
  // At small scales neighbouring widths crowd together: a label only where it has room, the tick always.
  let lastLabel = -Infinity;
  return (
    <div className="relative shrink-0" style={{ width: width * scale, height: RULER }}>
      <div className="absolute inset-x-0 bottom-0 h-1.5 rounded-sm bg-muted" />
      {BREAKPOINTS.map((point) => {
        const inside = point < width;
        const labelled = point === width || point * scale - lastLabel >= 28;
        if (labelled && inside) lastLabel = point * scale;
        return (
          <button
            key={point}
            type="button"
            onClick={() => onPick(point)}
            className={cn(
              "absolute bottom-0 flex -translate-x-1/2 flex-col items-center text-[10px] tabular-nums leading-none hover:text-primary",
              point === width ? "font-semibold text-primary" : inside ? "text-muted-foreground" : "hidden",
            )}
            style={{ left: Math.min(point, width) * scale }}
            title={`${point}px`}
          >
            <span className={cn("mb-0.5", labelled ? undefined : "invisible")}>{point}</span>
            <span className="h-2.5 w-px bg-current" />
          </button>
        );
      })}
    </div>
  );
}

type ScreenshotLibrary = { domToBlob: typeof domToBlob };
let library: Promise<ScreenshotLibrary> | null = null;

/** modern-screenshot comes from the plugin server on the first screenshot, as the page inside gets it. */
function loadLibrary() {
  const scope = globalThis as { modernScreenshot?: ScreenshotLibrary };
  library ??= new Promise<ScreenshotLibrary>((resolve, reject) => {
    if (scope.modernScreenshot) return resolve(scope.modernScreenshot);
    const script = document.createElement("script");
    script.src = SCREENSHOT_LIBRARY;
    script.onload = () => (scope.modernScreenshot ? resolve(scope.modernScreenshot) : reject(new Error("modern-screenshot did not load")));
    script.onerror = () => reject(new Error("modern-screenshot did not load"));
    document.head.append(script);
  });
  library.catch(() => { library = null; });
  return library;
}

/** The page in `frame` draws its viewport (its scripts have run) and hands the PNG back. */
function captureFrame(frame: HTMLIFrameElement, scale: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    const timer = setTimeout(() => { done(); reject(new Error(t("htmlShotTimeout"))); }, 90_000);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string; url?: string; error?: string } | null;
      if (event.source !== frame.contentWindow || data?.type !== "ov-captured" || data.id !== id) return;
      done();
      if (data.url) resolve(data.url);
      else reject(new Error(data.error || t("htmlShotTimeout")));
    };
    window.addEventListener("message", onMessage);
    frame.contentWindow?.postMessage({ type: "ov-capture", id, scale }, "*");
  });
}

/** Photos larger than any device shows them are scaled down before they go into the shot. */
const MAX_PICTURE = 1600;

async function shrink(blob: Blob): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) return blob;
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return blob;
  const factor = MAX_PICTURE / Math.max(bitmap.width, bitmap.height);
  if (factor >= 1) { bitmap.close(); return blob; }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * factor);
  canvas.height = Math.round(bitmap.height * factor);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((small) => resolve(small ?? blob), blob.type, 0.9));
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** A page to show: its HTML, the folder (or site) its relative links resolve against, and where it can be opened. */
export type Page = {
  html: string;
  /** What relative links resolve against. */
  base: string;
  /** Files under this prefix may be read for a screenshot: the file's folder, or the whole site. */
  scope: string;
  openUrl: string;
  subtitle: string | null;
};

/** Where pages come from: a file on a BB machine, or a site on the web. */
export type PageSource = {
  load(): Promise<Page>;
  /** A file of the page's own site, for screenshots; the caller has checked it lies inside the site. */
  fetchFile(url: string): Promise<Blob>;
  /** Saves a screenshot next to the page, when the composer can't take an attachment; returns where. */
  save?(name: string, picture: Blob): Promise<string>;
};

export function HtmlOpener({ path, source, Original }: PluginFileOpenerProps) {
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
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  // The preview link lives ten minutes: every load asks for a fresh one, so later relative loads keep working.
  const pages = useMemo<PageSource>(
    () => ({
      async load() {
        const file = await rpc.call("open", request);
        const absolute = new URL(file.url, window.location.href).href;
        const response = await fetch(`${absolute}${absolute.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? t("fileMissing", { path: file.absPath }) : `HTTP ${response.status}`);
        const folder = new URL(".", absolute).href;
        return { html: decodeHtml(new Uint8Array(await response.arrayBuffer())), base: folder, scope: folder, openUrl: absolute, subtitle: file.hostName };
      },
      async fetchFile(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      },
      async save(name, picture) {
        const bytes = new Uint8Array(await picture.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return (await rpc.call("writeImage", { ...request, name, base64: btoa(binary), overwrite: false })).absPath;
      },
    }),
    [rpc, request],
  );
  return <DevicesViewer pages={pages} title={fileName} address={path} Original={Original} />;
}

/**
 * The device viewer around any page: mockups, comparison, rotation, ruler, screenshots. `heading` replaces the
 * title block (the site viewer puts its address bar there); `Original` adds the source-code toggle.
 */
export function DevicesViewer({ pages, title, address, heading, Original }: { pages: PageSource; title: string; address: string; heading?: ReactNode; Original?: ComponentType }) {
  const composer = useComposer();
  const fileName = title;
  const path = address;

  const [layout, update] = useLayout();
  const [showSource, setShowSource] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  /** Where the page's files may be read from for a screenshot. */
  const [site, setSite] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [hostName, setHostName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [picking, setPicking] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** While a resize handle is dragged the scale holds still, so the frame follows the pointer. */
  const [dragScale, setDragScale] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frames = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const area = useSize(stage, !showSource);

  const load = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const page = await pages.load();
      if (run !== generation.current) return;
      setUrl(page.openUrl);
      setSite(page.scope);
      setDoc(prepareHtml(page.html, page.base));
      setHostName(page.subtitle);
      setFrameKey((key) => key + 1);
    } catch (cause) {
      if (run === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, [pages]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ready before the first screenshot is asked for.
  useEffect(() => {
    loadLibrary().catch(() => undefined);
  }, []);

  // The sandboxed page can't read its own folder while it draws itself: the viewer reads files for it, from that folder only.
  useEffect(() => {
    if (!site) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: number; url?: unknown } | null;
      if (data?.type !== "ov-fetch") return;
      const owner = Array.from(frames.current?.querySelectorAll("iframe") ?? []).some((frame) => frame.contentWindow === event.source);
      if (!owner) return;
      const reply = (dataUrl: string | false) => (event.source as Window).postMessage({ type: "ov-fetched", id: data.id, dataUrl }, "*");
      if (typeof data.url !== "string" || !insideSite(data.url, site)) return reply(false);
      const url = new URL(data.url, site).href;
      // Every device asks for the same photos and fonts: each is fetched and scaled down once per page load.
      let file = files.get(url);
      if (!file) {
        file = pages
          .fetchFile(url)
          .then(shrink)
          .then(blobToDataUrl)
          .catch(() => false as const);
        files.set(url, file);
      }
      void file.then(reply);
    };
    const files = new Map<string, Promise<string | false>>();
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [site, pages]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!picking) return;
    const close = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setPicking(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [picking]);

  const preset = layout.device === "custom" ? null : deviceById(layout.device);
  const single = screenOf(preset, layout);
  const screens: Screen[] =
    layout.mode === "compare"
      ? layout.compare.map(deviceById).filter((device): device is Device => device !== null).map((device) => screenOf(device, layout))
      : [single];
  // Bezels and captions keep their size at any scale: room for them is set aside before fitting the pages.
  const { scale: fit, columns } = fitGrid(
    screens.map((screen) => screen.mock.outer),
    { w: area.w - 2 * PAD, h: area.h - 2 * PAD },
    GAP,
    { w: 0, h: LABEL + (layout.mode === "single" && layout.ruler ? RULER : 0) },
    CAPTION_MIN,
  );
  const scale = dragScale ?? (layout.zoom === "fit" ? fit : layout.zoom);
  const rows: Screen[][] = [];
  for (let at = 0; at < screens.length; at += columns) rows.push(screens.slice(at, at + columns));

  const setCustom = (size: Size) => update({ device: "custom", custom: { w: clampSide(size.w), h: clampSide(size.h) } });

  const startResize = (start: Size, frozen: number, event: ReactPointerEvent, axis: "x" | "y" | "xy") => {
    event.preventDefault();
    const x0 = event.clientX;
    const y0 = event.clientY;
    setDragScale(frozen);
    const move = (moved: PointerEvent) => {
      // The frame stays centred, so each edge moves half as far as the size changes: double the pointer travel.
      setCustom({
        w: axis === "y" ? start.w : start.w + ((moved.clientX - x0) * 2) / frozen,
        h: axis === "x" ? start.h : start.h + ((moved.clientY - y0) * 2) / frozen,
      });
    };
    const end = () => {
      setDragScale(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void root.current?.requestFullscreen?.().catch(() => undefined);
  };

  const screenshot = async () => {
    const element = frames.current;
    if (!element) return;
    setBusy(true);
    try {
      // Drawn larger than on screen, up to the devices' own size or about 1600 px across: sharp enough, light for the chat.
      const factor = Math.max(1, Math.min(1 / scale, 1600 / Math.max(1, element.getBoundingClientRect().width)));
      const iframes = Array.from(element.querySelectorAll<HTMLIFrameElement>("iframe[data-shot]"));
      const [lib, pictures] = await Promise.all([loadLibrary(), Promise.all(iframes.map((frame) => captureFrame(frame, Math.min(1, scale * factor))))]);
      setShots(Object.fromEntries(iframes.map((frame, index) => [frame.dataset.shot!, pictures[index]!])));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.all(Array.from(element.querySelectorAll<HTMLImageElement>("img[data-shot-image]")).map((image) => image.decode().catch(() => undefined)));
      const png = await lib.domToBlob(element, {
        scale: factor,
        type: "image/webp",
        quality: 0.85,
        font: false,
        filter: (node) => !(node instanceof Element && node.hasAttribute("data-shot-skip")),
      });
      const orientation = (size: Size) => (size.w > size.h ? t("htmlLandscape") : t("htmlPortrait"));
      const caption = screens.map((screen) => `${screen.name} ${screen.size.w}×${screen.size.h} (${orientation(screen.size)})`).join(", ");
      const stem = fileName.replace(/\.[^.]+$/, "");
      const name = `${stem}-${layout.mode === "compare" ? "compare" : `${single.key}-${single.size.w}x${single.size.h}`}.webp`;
      // VK core function `image-editor`: a real attachment in the draft instead of a saved file.
      const attach = (composer as typeof composer & { experimental_vkAttachFiles?: (files: File[]) => Promise<void> }).experimental_vkAttachFiles;
      if (typeof attach === "function") {
        await attach.call(composer, [new File([png], name, { type: "image/webp" })]);
        composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${fileName}: ${caption}\n\n`);
        composer.focus();
        toast.success(t("attachedToChat"));
        return;
      }
      if (!pages.save) {
        // Nowhere to save it: the picture goes to the device as a download.
        const href = URL.createObjectURL(png);
        const a = document.createElement("a");
        a.href = href;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
        return;
      }
      const savedPath = await pages.save(name, png);
      composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${t("htmlShotNote", { caption, path: savedPath })}\n\n`);
      composer.focus();
      toast.success(t("sentToChat"));
    } catch (cause) {
      toast.error(`${t("htmlShotFailed")}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setShots({});
      setBusy(false);
    }
  };

  const groups: [string, DeviceKind][] = [[t("htmlPhones"), "phone"], [t("htmlTablets"), "tablet"], [t("htmlDesktops"), "desktop"]];

  const toolbar = (
    <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-border px-2 py-1">
      {heading ?? (
        <div className="min-w-0 flex-1 basis-32 px-1">
          <div className="truncate text-sm font-medium" title={path}>{fileName}</div>
          {hostName ? <div className="truncate text-xs text-muted-foreground">{hostName}</div> : null}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {showSource ? (
          <ToolButton label={t("htmlDevices")} icon={SmartPhone01Icon} onClick={() => setShowSource(false)}>
            <span className="hidden sm:inline">{t("htmlDevices")}</span>
          </ToolButton>
        ) : (
          <>
            <ToolButton
              label={layout.mode === "compare" ? t("htmlSingle") : t("htmlCompare")}
              icon={LayoutTwoColumnIcon}
              pressed={layout.mode === "compare"}
              onClick={() => update({ mode: layout.mode === "compare" ? "single" : "compare" })}
            />
            {layout.mode === "single" ? (
              <>
                <select
                  aria-label={t("htmlDevice")}
                  title={`${t("htmlDevice")}\n${t("htmlShares")}`}
                  value={layout.device}
                  onChange={(event) => update({ device: event.target.value })}
                  className="h-8 max-w-40 rounded-md border border-input bg-transparent px-1.5 text-xs"
                >
                  {groups.map(([label, kind]) => (
                    <optgroup key={kind} label={label}>
                      {DEVICES.filter((device) => device.kind === kind).map((device) => (
                        <option key={device.id} value={device.id}>{device.main ? "★ " : ""}{device.name} · {device.width}×{device.height}{device.share ? ` · ${device.share}%` : ""}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="custom">{t("htmlCustom")}</option>
                </select>
                <SideInput label={t("htmlWidth")} value={single.size.w} onCommit={(w) => setCustom({ w, h: single.size.h })} />
                <span className="text-xs text-muted-foreground">×</span>
                <SideInput label={t("htmlHeight")} value={single.size.h} onCommit={(h) => setCustom({ w: single.size.w, h })} />
              </>
            ) : (
              <div ref={picker} className="relative">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" aria-expanded={picking} onClick={() => setPicking((open) => !open)}>
                  {t("htmlCompareDevices")} · {screens.length}
                </Button>
                {picking ? (
                  <div className="absolute left-0 top-9 z-20 max-h-96 w-72 overflow-auto rounded-md border border-border bg-popover p-1 text-xs shadow-md">
                    <button
                      type="button"
                      title={t("htmlMainHint")}
                      className="flex w-full items-center rounded px-2 py-1.5 text-left font-medium hover:bg-accent"
                      onClick={() => update({ compare: MAIN_DEVICES })}
                    >
                      {t("htmlMainOnly")}
                    </button>
                    {groups.map(([label, kind]) => (
                      <div key={kind}>
                        <div className="px-2 pb-0.5 pt-1.5 font-medium text-muted-foreground">{label}</div>
                        {DEVICES.filter((device) => device.kind === kind).map((device) => {
                          const on = layout.compare.includes(device.id);
                          return (
                            <label key={device.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-accent">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={on && layout.compare.length === 1}
                                onChange={() => update({ compare: on ? layout.compare.filter((id) => id !== device.id) : DEVICES.map((d) => d.id).filter((id) => id === device.id || layout.compare.includes(id)) })}
                              />
                              <span className="flex-1">{device.main ? "★ " : ""}{device.name}</span>
                              <span className="tabular-nums text-muted-foreground">{device.width}×{device.height}{device.share ? ` · ${device.share}%` : ""}</span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            <ToolButton
              label={t("htmlRotate")}
              icon={RotateClockwiseIcon}
              pressed={layout.rotated}
              onClick={() => (layout.mode === "single" && layout.device === "custom" ? update({ custom: { w: layout.custom.h, h: layout.custom.w } }) : update({ rotated: !layout.rotated }))}
            />
            <select
              aria-label={t("htmlScale")}
              title={t("htmlScale")}
              value={String(layout.zoom)}
              onChange={(event) => update({ zoom: event.target.value === "fit" ? "fit" : Number(event.target.value) })}
              className="h-8 rounded-md border border-input bg-transparent px-1.5 text-xs tabular-nums"
            >
              <option value="fit">{t("htmlFit")} · {Math.round(fit * 100)}%</option>
              {ZOOMS.map((zoom) => <option key={zoom} value={zoom}>{zoom * 100}%</option>)}
            </select>
            {layout.mode === "single" ? <ToolButton label={t("htmlBreakpoints")} icon={RulerIcon} pressed={layout.ruler} onClick={() => update({ ruler: !layout.ruler })} /> : null}
            <ToolButton label={t("htmlShotHint")} icon={busy ? Loading03Icon : Camera01Icon} disabled={!doc || busy} onClick={() => void screenshot()}>
              <span className="hidden md:inline">{t("htmlShot")}</span>
            </ToolButton>
            <ToolButton label={t("htmlReload")} icon={ArrowReloadHorizontalIcon} disabled={loading} onClick={() => void load()} />
            {url ? <ToolButton label={t("htmlOpenTab")} icon={Link01Icon} onClick={() => window.open(url, "_blank", "noopener")} /> : null}
            <ToolButton label={fullscreen ? t("htmlExitFullscreen") : t("htmlFullscreen")} icon={fullscreen ? MinimizeScreenIcon : FullScreenIcon} onClick={toggleFullscreen} />
            {Original ? <ToolButton label={t("htmlSource")} icon={SourceCodeIcon} onClick={() => setShowSource(true)} /> : null}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div ref={root} className="flex h-full min-h-0 flex-col bg-background">
      {toolbar}
      {showSource ? (
        <div className="min-h-0 flex-1 overflow-hidden">{Original ? <Original /> : null}</div>
      ) : (
        <div ref={stage} className="relative min-h-0 flex-1 overflow-auto bg-muted/30">
          {error ? (
            <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
              <span className="font-medium">{t("openFailed")}</span>
              <span className="max-w-lg break-words text-muted-foreground">{error}</span>
              <Button variant="outline" size="sm" onClick={() => void load()}>{t("retry")}</Button>
            </div>
          ) : !doc || !area.w ? (
            <div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>
          ) : (
            <div className="flex min-h-full w-max min-w-full items-center justify-center" style={{ padding: PAD }}>
              <div ref={frames} className="flex flex-col items-center" style={{ gap: GAP }}>
                {layout.mode === "single" ? (
                  <Frame
                    screen={single}
                    scale={scale}
                    doc={doc}
                    shot={shots[single.key]}
                    frameKey={frameKey}
                    title={fileName}
                    address={path}
                    ruler={layout.ruler ? (w) => setCustom({ w, h: single.size.h }) : undefined}
                    onResize={layout.device === "custom" ? startResize : undefined}
                  />
                ) : (
                  rows.map((row, index) => (
                    <div key={index} className="flex items-start" style={{ gap: GAP }}>
                      {row.map((screen) => <Frame key={screen.key} screen={screen} scale={scale} doc={doc} shot={shots[screen.key]} frameKey={frameKey} title={fileName} address={path} />)}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {/* Iframes swallow pointer events: while resizing, a cover keeps the drag going. */}
          {dragScale !== null ? <div className="fixed inset-0 z-50 cursor-grabbing" /> : null}
        </div>
      )}
    </div>
  );
}

/** A side in CSS pixels: typing commits on Enter or blur, Escape restores. */
function SideInput({ label, value, onCommit }: { label: string; value: number; onCommit(value: number): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const number = parseInt(draft ?? "", 10);
    if (number) onCommit(number);
    setDraft(null);
  };
  return (
    <Input
      inputMode="numeric"
      aria-label={label}
      title={label}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        else if (event.key === "Escape") { setDraft(null); event.currentTarget.blur(); }
      }}
      className="h-8 w-14 px-1 text-center text-xs tabular-nums"
    />
  );
}
