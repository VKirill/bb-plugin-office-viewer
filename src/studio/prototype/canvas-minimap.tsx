import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import type { WireframeCanvas, WireframeElement } from "./model";

export function CanvasMinimap({
  canvas,
  elements,
  viewport,
  onJump,
  className,
}: {
  canvas: WireframeCanvas;
  elements: readonly WireframeElement[];
  viewport: { left: number; top: number; width: number; height: number };
  onJump: (centerX: number, centerY: number) => void;
  className?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const scale = 96 / Math.max(canvas.width, canvas.height);

  const pointerToBoard = (clientX: number, clientY: number) => {
    const node = ref.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    return { x, y };
  };

  return (
    <div
      ref={ref}
      className={cn("pointer-events-auto rounded border border-border bg-background/95 p-1 shadow-sm", className)}
      title={t("protoMinimap")}
      onPointerDown={(event) => {
        const p = pointerToBoard(event.clientX, event.clientY);
        if (p) onJump(p.x, p.y);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const p = pointerToBoard(event.clientX, event.clientY);
        if (p) onJump(p.x, p.y);
      }}
    >
      <div className="relative bg-muted/40" style={{ width: canvas.width * scale, height: canvas.height * scale }}>
        {elements.filter((el) => !el.hidden).map((el) => (
          <div
            key={el.id}
            className="absolute bg-foreground/25"
            style={{ left: el.x * scale, top: el.y * scale, width: el.w * scale, height: el.h * scale }}
          />
        ))}
        <div
          className="pointer-events-none absolute border border-primary"
          style={{
            left: viewport.left * scale,
            top: viewport.top * scale,
            width: viewport.width * scale,
            height: viewport.height * scale,
          }}
        />
      </div>
    </div>
  );
}
