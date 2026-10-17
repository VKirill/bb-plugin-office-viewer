import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { t } from "../../shared/i18n";
import { CANVAS_PRESETS, SNAP, snap, type WireframeCanvas, type WireframeElement } from "./model";

const PrototypeOverlayCloseContext = createContext<(() => void) | null>(null);

export function PrototypeOverlayCloseButton() {
  const onClose = useContext(PrototypeOverlayCloseContext);
  if (!onClose) return null;
  const label = t("protoClosePanel");
  return (
    <button type="button" className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} title={label} aria-label={label}>
      <Icon name="X" className="size-4" />
    </button>
  );
}

export function PrototypeShell({
  shellRef,
  compact,
  leftOpen,
  rightOpen,
  leftOverlay,
  rightOverlay,
  setLeftOverlay,
  setRightOverlay,
  toolbar,
  styleBar,
  leftPane,
  canvas,
  inspector,
  dialogs,
}: {
  shellRef: React.RefObject<HTMLDivElement | null>;
  compact: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  leftOverlay: boolean;
  rightOverlay: boolean;
  setLeftOverlay: (open: boolean) => void;
  setRightOverlay: (open: boolean) => void;
  toolbar: ReactNode;
  styleBar: ReactNode;
  leftPane: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  dialogs: ReactNode;
}) {
  const showLeft = leftOpen && !compact;
  const showRight = rightOpen && !compact;
  const leftRailRef = useRef<HTMLButtonElement>(null);
  const rightRailRef = useRef<HTMLButtonElement>(null);

  const closeLeftOverlay = useCallback(() => {
    setLeftOverlay(false);
    requestAnimationFrame(() => leftRailRef.current?.focus());
  }, [setLeftOverlay]);

  const closeRightOverlay = useCallback(() => {
    setRightOverlay(false);
    requestAnimationFrame(() => rightRailRef.current?.focus());
  }, [setRightOverlay]);

  const overlayOpen = compact && (leftOverlay || rightOverlay);

  const closeOpenOverlays = useCallback(() => {
    if (leftOverlay) closeLeftOverlay();
    else if (rightOverlay) closeRightOverlay();
  }, [closeLeftOverlay, closeRightOverlay, leftOverlay, rightOverlay]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeOpenOverlays();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOpenOverlays, overlayOpen]);

  return (
    <div ref={shellRef} className="flex h-full min-h-0 flex-col bg-background outline-none">
      {toolbar}
      {styleBar}
      <div className="relative flex min-h-0 flex-1">
        {compact ? (
          <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-border py-2">
            <Button ref={leftRailRef} type="button" variant="ghost" size="icon" className="size-8" onClick={() => setLeftOverlay(true)} aria-label={t("protoToggleLeft")}>
              <Icon name="PanelLeft" className="size-4" />
            </Button>
          </div>
        ) : showLeft ? (
          <div className="flex w-[260px] shrink-0 flex-col border-r border-border">{leftPane}</div>
        ) : null}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {overlayOpen ? (
            <button type="button" className="absolute inset-0 z-30 bg-black/10 dark:bg-black/30" aria-label={t("protoClosePanel")} onClick={closeOpenOverlays} />
          ) : null}
          {canvas}
        </div>
        {compact ? (
          <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-l border-border py-2">
            <Button ref={rightRailRef} type="button" variant="ghost" size="icon" className="size-8" onClick={() => setRightOverlay(true)} aria-label={t("protoToggleRight")}>
              <Icon name="PanelRight" className="size-4" />
            </Button>
          </div>
        ) : showRight ? (
          <div className="flex w-[260px] shrink-0 flex-col">{inspector}</div>
        ) : null}
        {compact && leftOverlay ? (
          <PrototypeOverlayCloseContext.Provider value={closeLeftOverlay}>
            <div className="absolute inset-y-0 left-0 z-40 flex w-[min(280px,90vw)] animate-in slide-in-from-left duration-150">
              <div className="flex min-h-0 flex-1 flex-col border-r border-border bg-background">{leftPane}</div>
            </div>
          </PrototypeOverlayCloseContext.Provider>
        ) : null}
        {compact && rightOverlay ? (
          <PrototypeOverlayCloseContext.Provider value={closeRightOverlay}>
            <div className="absolute inset-y-0 right-0 z-40 flex w-[min(280px,90vw)] animate-in slide-in-from-right duration-150">
              <div className="flex min-h-0 flex-1 flex-col border-l border-border bg-background">{inspector}</div>
            </div>
          </PrototypeOverlayCloseContext.Provider>
        ) : null}
      </div>
      {dialogs}
    </div>
  );
}

export function PrototypeStyleBar({
  inspect,
  canvas,
  onCanvas,
  onUpdate,
}: {
  inspect: WireframeElement | null;
  canvas: WireframeCanvas;
  onCanvas: (patch: Partial<WireframeCanvas>) => void;
  onUpdate: (patch: Partial<WireframeElement>) => void;
}) {
  if (!inspect) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-1 text-xs">
        <span className="text-muted-foreground">{t("protoStylePage")}</span>
        {(Object.keys(CANVAS_PRESETS) as (keyof typeof CANVAS_PRESETS)[]).map((id) => (
          <button key={id} type="button" className="rounded border border-border px-2 py-0.5 hover:bg-state-hover" onClick={() => onCanvas({ ...CANVAS_PRESETS[id] })}>
            {t(id === "desktop" ? "protoDesktop" : id === "tablet" ? "protoTablet" : "protoPhone")}
          </button>
        ))}
        <NumInline label="W" value={canvas.width} onChange={(value) => onCanvas({ width: Math.max(SNAP, snap(value)) })} />
        <NumInline label="H" value={canvas.height} onChange={(value) => onCanvas({ height: Math.max(SNAP, snap(value)) })} />
        <Input className="h-7 w-24" value={canvas.background} onChange={(event) => onCanvas({ background: event.target.value })} />
      </div>
    );
  }
  const fill = typeof inspect.props.fill === "string" ? inspect.props.fill : typeof inspect.props.fillColor === "string" ? inspect.props.fillColor : "";
  const radius = typeof inspect.props.radius === "number" ? inspect.props.radius : 0;
  const fontSize = typeof inspect.props.fontSize === "number" ? inspect.props.fontSize : 14;
  const color = typeof inspect.props.color === "string" ? inspect.props.color : "";
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-1 text-xs">
      <NumInline label="X" value={inspect.x} onChange={(value) => onUpdate({ x: snap(value) })} />
      <NumInline label="Y" value={inspect.y} onChange={(value) => onUpdate({ y: snap(value) })} />
      <NumInline label="W" value={inspect.w} onChange={(value) => onUpdate({ w: Math.max(SNAP, snap(value)) })} />
      <NumInline label="H" value={inspect.h} onChange={(value) => onUpdate({ h: Math.max(SNAP, snap(value)) })} />
      <Input className="h-7 w-20" placeholder={t("protoPropFill")} value={fill} onChange={(event) => onUpdate({ props: { ...inspect.props, fill: event.target.value } })} />
      <NumInline label="R" value={radius} onChange={(value) => onUpdate({ props: { ...inspect.props, radius: value } })} />
      <NumInline label="Px" value={fontSize} onChange={(value) => onUpdate({ props: { ...inspect.props, fontSize: value } })} />
      <Input className="h-7 w-20" placeholder={t("protoPropColor")} value={color} onChange={(event) => onUpdate({ props: { ...inspect.props, color: event.target.value } })} />
    </div>
  );
}

function NumInline({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}</span>
      <input type="number" className="h-7 w-14 rounded border border-input bg-transparent px-1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
