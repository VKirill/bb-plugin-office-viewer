import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { t } from "../../shared/i18n";
import { CANVAS_PRESETS, SNAP, snap, type WireframeCanvas, type WireframeElement } from "./model";

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

  return (
    <div ref={shellRef} className="flex h-full min-h-0 flex-col bg-background outline-none">
      {toolbar}
      {styleBar}
      <div className="relative flex min-h-0 flex-1">
        {compact ? (
          <>
            <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-border py-2">
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setLeftOverlay(true)} aria-label={t("protoToggleLeft")}>
                <Icon name="PanelLeft" className="size-4" />
              </Button>
            </div>
            {leftOverlay ? (
              <div className="absolute inset-y-0 left-0 z-40 flex w-[min(280px,90vw)] shadow-lg">
                <div className="flex min-h-0 flex-1 flex-col border-r border-border bg-background">{leftPane}</div>
                <button type="button" className="absolute right-0 top-2 z-50 -translate-x-full rounded-l bg-background px-1 py-2 text-xs shadow" onClick={() => setLeftOverlay(false)}>×</button>
              </div>
            ) : null}
          </>
        ) : showLeft ? (
          <div className="flex w-[260px] shrink-0 flex-col border-r border-border">{leftPane}</div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">{canvas}</div>
        {compact ? (
          <>
            <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-l border-border py-2">
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setRightOverlay(true)} aria-label={t("protoToggleRight")}>
                <Icon name="PanelRight" className="size-4" />
              </Button>
            </div>
            {rightOverlay ? (
              <div className="absolute inset-y-0 right-0 z-40 flex w-[min(280px,90vw)] shadow-lg">
                <button type="button" className="absolute left-0 top-2 z-50 -translate-x-full rounded-r bg-background px-1 py-2 text-xs shadow" onClick={() => setRightOverlay(false)}>×</button>
                <div className="flex min-h-0 flex-1 flex-col border-l border-border bg-background">{inspector}</div>
              </div>
            ) : null}
          </>
        ) : showRight ? (
          <div className="flex w-[260px] shrink-0 flex-col">{inspector}</div>
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
