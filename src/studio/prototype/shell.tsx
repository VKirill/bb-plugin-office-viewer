import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useT, type I18nKey } from "../../shared/i18n";
import {
  CANVAS_BACKGROUND_PRESETS,
  CANVAS_PRESET_ENTRIES,
  CANVAS_PRESET_GROUPS,
  SNAP,
  findCanvasPreset,
  isCustomCanvasSize,
  snap,
  swapCanvasOrientation,
  type WireframeCanvas,
  type WireframeElement,
} from "./model";

const PrototypeOverlayCloseContext = createContext<(() => void) | null>(null);

export function PrototypeOverlayCloseButton() {
  const t = useT();
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
  const t = useT();
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
    <div
      ref={shellRef}
      className="flex h-full min-h-0 flex-col bg-background outline-none"
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).closest("input, textarea, [contenteditable='true']")) return;
        event.preventDefault();
      }}
    >
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
  const t = useT();
  if (!inspect) {
    return <PageCanvasStyleBar canvas={canvas} onCanvas={onCanvas} />;
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

function PageCanvasStyleBar({ canvas, onCanvas }: { canvas: WireframeCanvas; onCanvas: (patch: Partial<WireframeCanvas>) => void }) {
  const t = useT();
  const [sizeOpen, setSizeOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const matched = findCanvasPreset(canvas.width, canvas.height);
  const custom = isCustomCanvasSize(canvas.width, canvas.height);
  const sizeLabel = matched ? t(matched.labelKey as I18nKey) : t("protoCustomSize");

  useEffect(() => {
    if (!sizeOpen && !bgOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) {
        setSizeOpen(false);
        setBgOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [bgOpen, sizeOpen]);

  return (
    <div ref={barRef} className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2 py-1 text-xs">
      <div className="relative" data-style-menu>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" aria-expanded={sizeOpen} onClick={() => { setSizeOpen((open) => !open); setBgOpen(false); }}>
          <Icon name={(matched?.icon ?? "AppWindow") as IconName} className="size-3.5" />
          <span className="max-w-28 truncate">{t("protoScreenSize")}: {sizeLabel}</span>
          <Icon name="ChevronDown" className="size-3" />
        </Button>
        {sizeOpen ? (
          <div className="absolute left-0 z-30 mt-1 w-56 rounded-md border border-border bg-background p-1 shadow-md">
            {CANVAS_PRESET_GROUPS.map((group) => {
              const items = CANVAS_PRESET_ENTRIES.filter((entry) => entry.group === group.id);
              return (
                <div key={group.id} className="py-0.5">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t(group.labelKey as I18nKey)}</div>
                  {items.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-state-hover",
                        matched?.id === entry.id && "bg-muted",
                      )}
                      onClick={() => {
                        onCanvas({ width: entry.width, height: entry.height });
                        setSizeOpen(false);
                      }}
                    >
                      <Icon name={entry.icon as IconName} className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{t(entry.labelKey as I18nKey)}</span>
                      <span className="tabular-nums text-muted-foreground">{entry.width}×{entry.height}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <NumInline
        label={custom ? t("protoCustomSize") : "W"}
        value={canvas.width}
        onChange={(value) => onCanvas({ width: Math.max(SNAP, snap(value)) })}
      />
      <NumInline label="H" value={canvas.height} onChange={(value) => onCanvas({ height: Math.max(SNAP, snap(value)) })} />
      <span title={t("protoCanvasOrientation")} className="inline-flex">
        <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t("protoCanvasOrientation")} onClick={() => onCanvas(swapCanvasOrientation(canvas))}>
          <Icon name="RotateCcw" className="size-3.5" />
        </Button>
      </span>
      <div className="relative" data-style-menu>
        <button
          type="button"
          className="size-7 rounded border border-border shadow-sm"
          style={{ background: canvas.background }}
          title={t("protoCanvasBackground")}
          aria-label={t("protoCanvasBackground")}
          aria-expanded={bgOpen}
          onClick={() => { setBgOpen((open) => !open); setSizeOpen(false); }}
        />
        {bgOpen ? (
          <div className="absolute left-0 z-30 mt-1 w-44 rounded-md border border-border bg-background p-2 shadow-md">
            <div className="mb-2 grid grid-cols-6 gap-1">
              {CANVAS_BACKGROUND_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn("size-6 rounded border border-border", canvas.background === color && "ring-2 ring-ring")}
                  style={{ background: color }}
                  onClick={() => onCanvas({ background: color })}
                />
              ))}
            </div>
            <Input className="h-7 font-mono text-xs" value={canvas.background} onChange={(event) => onCanvas({ background: event.target.value })} />
          </div>
        ) : null}
      </div>
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
