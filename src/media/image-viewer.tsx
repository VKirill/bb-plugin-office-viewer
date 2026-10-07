// Office Viewer — image view: fits the panel, zooms with pinch, Cmd/Ctrl+wheel,
// double-click and keys, pans by dragging, shows a checkerboard under
// transparency, the pixel size and the neighbouring images of the folder.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, ZoomInIcon, ZoomOutIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { t } from "../shared/i18n";

const CHECKER = {
  backgroundColor: "#ffffff",
  backgroundImage: "conic-gradient(#e5e7eb 25%, #ffffff 0 50%, #e5e7eb 0 75%, #ffffff 0)",
  backgroundSize: "16px 16px",
};
const MIN = 0.02, MAX = 16;

export type ImageViewerHandle = { zoomIn(): void; zoomOut(): void; fit(): void; actual(): void };

export const ImageViewer = forwardRef<
  ImageViewerHandle,
  { src: string; alt: string; position: { index: number; total: number } | null; onStep: (delta: 1 | -1) => void }
>(function ImageViewer({ src, alt, position, onStep }, ref) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const scale = zoom ?? fit;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  /** Content point (in image pixels) to keep under the viewport point after a zoom. */
  const anchor = useRef<{ ix: number; iy: number; vx: number; vy: number } | null>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);

  useEffect(() => { setZoom(null); setNatural(null); }, [src]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || !natural) return;
    const measure = () => setFit(Math.min(1, (area.clientWidth - 16) / natural.w, (area.clientHeight - 16) / natural.h));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [natural]);

  /** Zooms to `next`, keeping the image point under (vx, vy) in place; the viewport centre by default. */
  const zoomTo = (next: number, vx?: number, vy?: number) => {
    const area = areaRef.current;
    const image = area?.querySelector("img");
    if (!area || !image) return setZoom(next);
    const a = area.getBoundingClientRect(), r = image.getBoundingClientRect();
    const px = vx ?? a.left + a.width / 2, py = vy ?? a.top + a.height / 2;
    anchor.current = { ix: (px - r.left) / scaleRef.current, iy: (py - r.top) / scaleRef.current, vx: px - a.left, vy: py - a.top };
    setZoom(Math.min(MAX, Math.max(MIN, next)));
  };

  useLayoutEffect(() => {
    const area = areaRef.current, point = anchor.current;
    const image = area?.querySelector("img");
    anchor.current = null;
    if (!area || !point || !image) return;
    const a = area.getBoundingClientRect(), r = image.getBoundingClientRect();
    area.scrollLeft += r.left - a.left + point.ix * scale - point.vx;
    area.scrollTop += r.top - a.top + point.iy * scale - point.vy;
  }, [scale]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomTo(scaleRef.current * 1.25),
    zoomOut: () => zoomTo(scaleRef.current / 1.25),
    fit: () => setZoom(null),
    actual: () => zoomTo(1),
  }));

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    // React's wheel listener is passive and can't stop the page from zooming.
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      zoomTo(scaleRef.current * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current!;
    if (event.button !== 0 || (area.scrollWidth <= area.clientWidth && area.scrollHeight <= area.clientHeight)) return;
    pan.current = { x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop, moved: false };
    area.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    p.moved = true;
    areaRef.current!.scrollLeft = p.left - (event.clientX - p.x);
    areaRef.current!.scrollTop = p.top - (event.clientY - p.y);
  };

  const zoomed = natural && (natural.w * scale > (areaRef.current?.clientWidth ?? Infinity) || natural.h * scale > (areaRef.current?.clientHeight ?? Infinity));

  return (
    <div className="relative size-full min-h-0">
      <div
        ref={areaRef}
        className={zoomed ? "size-full cursor-grab overflow-auto active:cursor-grabbing" : "size-full overflow-auto"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { pan.current = null; }}
        onDoubleClick={(event) => (zoom === null && fit < 1 ? zoomTo(1, event.clientX, event.clientY) : setZoom(null))}
      >
        <div className="flex min-h-full min-w-full items-center justify-center p-2" style={{ width: "max-content" }}>
          <img
            src={src}
            alt={alt}
            draggable={false}
            onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth || 300, h: event.currentTarget.naturalHeight || 150 })}
            className="block max-w-none select-none shadow-sm"
            style={{ ...CHECKER, width: natural ? natural.w * scale : undefined, height: natural ? natural.h * scale : undefined, imageRendering: scale >= 3 ? "pixelated" : undefined }}
          />
        </div>
      </div>

      {position && position.total > 1 ? (
        <>
          <button type="button" aria-label={t("previousImage")} title={`${t("previousImage")} (←)`} onClick={() => onStep(-1)} className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          </button>
          <button type="button" aria-label={t("nextImage")} title={`${t("nextImage")} (→)`} onClick={() => onStep(1)} className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background">
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
          </button>
        </>
      ) : null}

      <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-lg border border-border bg-background/90 px-1 py-0.5 text-xs shadow-sm backdrop-blur">
        {position && position.total > 1 ? <span className="px-1.5 tabular-nums text-muted-foreground">{position.index + 1} / {position.total}</span> : null}
        {natural ? <span className="px-1.5 tabular-nums text-muted-foreground">{natural.w} × {natural.h}</span> : null}
        <span title={`${t("zoomOut")} (⌘−)`} className="shrink-0"><Button variant="ghost" size="icon" className="size-7" aria-label={t("zoomOut")} onClick={() => zoomTo(scale / 1.25)}><HugeiconsIcon icon={ZoomOutIcon} size={15} /></Button></span>
        <button type="button" className="h-7 min-w-11 rounded-md px-1 tabular-nums hover:bg-state-hover" title={`${t("zoomFit")} / 100% (⌘0)`} onClick={() => (zoom === null ? zoomTo(1) : setZoom(null))}>{Math.round(scale * 100)}%</button>
        <span title={`${t("zoomIn")} (⌘+)`} className="shrink-0"><Button variant="ghost" size="icon" className="size-7" aria-label={t("zoomIn")} onClick={() => zoomTo(scale * 1.25)}><HugeiconsIcon icon={ZoomInIcon} size={15} /></Button></span>
      </div>
    </div>
  );
});
