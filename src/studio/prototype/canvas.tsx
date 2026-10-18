import type { DragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import type { BoardElement } from "./containers";
import { applyInlineDraft, type InlineEdit } from "./editing";
import { ElementFace } from "./elements";
import { HANDLE_CLASS, HANDLES, editOverlayBox } from "./builder-geometry";
import { wireframeElementBoxStyle } from "./inspector-model";
import type { CanvasRect, DistanceLine, ElementBox, SnapGuide } from "./canvas-math";
import { ConnectorsLayer, connectorHandlePoints } from "./connector-layer";
import { isConnector } from "./connectors";
import { elementHasInteractions } from "./interactions";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import { CanvasMinimap } from "./canvas-minimap";
import { isAutoLayoutStack, stackLayoutHandleMarkers, type PageDeviceView } from "./layout";
import { fidelityBoardClassName, type ProtoFidelity } from "./styles";
import { type WireframeCanvas, type WireframeComponent, type WireframeElement, type WireframePage, type WireframeStyleLibrary } from "./model";

export function PrototypeCanvas({
  canvasPaneRef,
  boardRef,
  openTabs,
  activePageId,
  onSelectPage,
  onCloseTab,
  canvas,
  elements,
  components = [],
  zoom,
  badges,
  notes,
  selected,
  one,
  edit,
  editInputRef,
  selectionBand,
  showSnapGrid,
  gridSize,
  marquee,
  snapGuides,
  distanceLines,
  moveTooltip,
  panning,
  insertMode,
  drawPreview = null,
  modifierHint = null,
  connectorTool = false,
  connectorHoverId = null,
  connectorDraft = null,
  boardItems,
  scopeOverlay = null,
  onOpenShortcuts = () => {},
  deviceView = "desktop",
  onDeviceViewChange,
  fidelity = "mockup",
  styleLibrary,
  minimapVisible = false,
  minimapViewport,
  onMinimapJump,
  onOpenTour,
  onPanePointerDown,
  onPanePointerMove,
  onPanePointerUp,
  onBoardPointerDown,
  onBoardPointerMove,
  onBoardPointerUp,
  onBoardDoubleClick,
  onBoardContextMenu,
  onPageTabContextMenu,
  onDrop,
  onEditChange,
  onInlineKeyDown,
  onCommitEdit,
  skipBlur,
  onPaneClick,
  resolveAsset,
  commentPins = [],
  onCommentPinClick,
}: {
  canvasPaneRef: RefObject<HTMLDivElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  openTabs: WireframePage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onCloseTab: (id: string) => void;
  canvas: WireframeCanvas;
  elements: WireframeElement[];
  components?: readonly WireframeComponent[];
  zoom: number;
  badges: boolean;
  notes: Map<string, number>;
  selected: string[];
  one: WireframeElement | null;
  edit: InlineEdit | null;
  editInputRef: RefObject<HTMLInputElement | null>;
  selectionBand: { left: number; top: number; right: number; bottom: number } | null;
  showSnapGrid: boolean;
  gridSize: number;
  marquee: CanvasRect | null;
  snapGuides: SnapGuide[];
  distanceLines: DistanceLine[];
  moveTooltip: { x: number; y: number; w: number; h: number } | null;
  panning: boolean;
  insertMode: boolean;
  drawPreview?: ElementBox | null;
  modifierHint?: string | null;
  connectorTool?: boolean;
  connectorHoverId?: string | null;
  connectorDraft?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  boardItems?: BoardElement[];
  scopeOverlay?: ReactNode;
  onOpenShortcuts?: () => void;
  deviceView?: PageDeviceView;
  onDeviceViewChange?: (view: PageDeviceView) => void;
  fidelity?: ProtoFidelity;
  styleLibrary?: WireframeStyleLibrary;
  minimapVisible?: boolean;
  minimapViewport?: { left: number; top: number; width: number; height: number };
  onMinimapJump?: (centerX: number, centerY: number) => void;
  onOpenTour?: () => void;
  onPanePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPanePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPanePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onBoardContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onPageTabContextMenu?: (pageId: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onEditChange: (draft: string) => void;
  onInlineKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onCommitEdit: () => void;
  skipBlur: React.MutableRefObject<boolean>;
  onPaneClick: () => void;
  resolveAsset?: (src: string) => string | undefined;
  commentPins?: { id: string; x: number; y: number; number: number; resolved?: boolean }[];
  onCommentPinClick?: (id: string) => void;
}) {
  const t = useT();
  const placed =
    boardItems ??
    elements
      .filter((el) => !el.hidden && !isConnector(el) && !el.parentId)
      .map((el) => ({ element: el, absX: el.x, absY: el.y }));
  const ticks = (max: number, step = 100) => {
    const out: number[] = [];
    for (let v = 0; v <= max; v += step) out.push(v);
    return out;
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-background px-2 py-1">
        <div className="flex shrink-0 gap-0.5">
        {openTabs.map((page) => (
          <button
            key={page.id}
            type="button"
            className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs", page.id === activePageId ? "bg-muted font-medium" : "text-muted-foreground hover:bg-state-hover")}
            onClick={() => onSelectPage(page.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              onPageTabContextMenu?.(page.id, event);
            }}
          >
            {page.name}
            {openTabs.length > 1 ? (
              <span
                role="button"
                tabIndex={-1}
                className="text-muted-foreground hover:text-foreground"
                onClick={(event) => { event.stopPropagation(); onCloseTab(page.id); }}
              >
                ×
              </span>
            ) : null}
          </button>
        ))}
        </div>
        {onDeviceViewChange ? (
          <div className="ml-auto flex shrink-0 gap-0.5 rounded-md border border-border p-0.5">
            {(["desktop", "tablet", "phone"] as PageDeviceView[]).map((view) => (
              <button
                key={view}
                type="button"
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-medium",
                  deviceView === view ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-state-hover",
                )}
                onClick={() => onDeviceViewChange(view)}
              >
                {view === "desktop" ? t("protoDeviceDesktop") : view === "tablet" ? t("protoDeviceTablet") : t("protoDevicePhone")}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div
        ref={canvasPaneRef}
        className={cn("min-h-0 flex-1 overflow-auto bg-muted/40 p-4", panning && "cursor-grabbing")}
        onClick={onPaneClick}
        onPointerDown={onPanePointerDown}
        onPointerMove={onPanePointerMove}
        onPointerUp={onPanePointerUp}
        onPointerCancel={onPanePointerUp}
      >
        <div className="inline-flex min-h-full min-w-full flex-col items-start">
          <div className="flex">
            <div className="size-5 shrink-0" />
            <div className="relative h-5 overflow-hidden" style={{ width: canvas.width * zoom }}>
              {ticks(canvas.width).map((x) => (
                <span key={x} className="absolute top-0 text-[9px] text-muted-foreground" style={{ left: x * zoom }}>{x}</span>
              ))}
              {selectionBand ? (
                <div className="absolute top-0 h-full bg-primary/20" style={{ left: selectionBand.left * zoom, width: (selectionBand.right - selectionBand.left) * zoom }} />
              ) : null}
            </div>
          </div>
          <div className="flex">
            <div className="relative w-5 shrink-0" style={{ height: canvas.height * zoom }}>
              {ticks(canvas.height).map((y) => (
                <span key={y} className="absolute left-0 text-[9px] text-muted-foreground" style={{ top: y * zoom }}>{y}</span>
              ))}
              {selectionBand ? (
                <div className="absolute left-0 w-full bg-primary/20" style={{ top: selectionBand.top * zoom, height: (selectionBand.bottom - selectionBand.top) * zoom }} />
              ) : null}
            </div>
            <div style={{ width: canvas.width * zoom, height: canvas.height * zoom }}>
              <div
                ref={boardRef}
                role="application"
                aria-label={t("protoCanvas")}
                className={cn("relative shrink-0 shadow-sm", insertMode && "cursor-crosshair", fidelityBoardClassName(fidelity), fidelity === "sketch" && "[&_[data-el]]:grayscale")}
                style={{ width: canvas.width, height: canvas.height, background: canvas.background, transform: `scale(${zoom})`, transformOrigin: "top left" }}
                onPointerDown={onBoardPointerDown}
                onPointerMove={onBoardPointerMove}
                onPointerUp={onBoardPointerUp}
                onPointerCancel={onBoardPointerUp}
                onDoubleClick={onBoardDoubleClick}
                onContextMenu={onBoardContextMenu}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
              >
                {showSnapGrid ? (
                  <div
                    data-proto-skip
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: "linear-gradient(to right, color-mix(in oklab, var(--border) 35%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 35%, transparent) 1px, transparent 1px)",
                      backgroundSize: `${gridSize}px ${gridSize}px`,
                    }}
                  />
                ) : null}
                {elements.length === 0 ? (
                  <div data-proto-skip className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">{t("protoEmptyCanvas")}</div>
                ) : null}
                {snapGuides.map((guide, index) =>
                  guide.axis === "x" ? (
                    <div
                      key={`g-${index}`}
                      data-proto-skip
                      className="pointer-events-none absolute bg-pink-500"
                      style={{ left: guide.at, top: guide.from, width: 1, height: guide.to - guide.from }}
                    />
                  ) : (
                    <div
                      key={`g-${index}`}
                      data-proto-skip
                      className="pointer-events-none absolute bg-pink-500"
                      style={{ left: guide.from, top: guide.at, width: guide.to - guide.from, height: 1 }}
                    />
                  ),
                )}
                {distanceLines.map((line, index) =>
                  line.axis === "x" ? (
                    <div key={`d-${index}`} data-proto-skip className="pointer-events-none absolute">
                      <div className="absolute bg-sky-500" style={{ left: line.from, top: line.at, width: line.to - line.from, height: 1 }} />
                      <span className="absolute -translate-x-1/2 text-[9px] text-sky-700" style={{ left: line.at, top: line.at - 12 }}>{Math.round(line.gap)}</span>
                    </div>
                  ) : (
                    <div key={`d-${index}`} data-proto-skip className="pointer-events-none absolute">
                      <div className="absolute bg-sky-500" style={{ left: line.at, top: line.from, width: 1, height: line.to - line.from }} />
                      <span className="absolute -translate-y-1/2 text-[9px] text-sky-700" style={{ left: line.at + 4, top: line.at }}>{Math.round(line.gap)}</span>
                    </div>
                  ),
                )}
                {marquee ? (
                  <div
                    data-proto-skip
                    className="pointer-events-none absolute border border-primary bg-primary/10"
                    style={{ left: marquee.left, top: marquee.top, width: marquee.right - marquee.left, height: marquee.bottom - marquee.top }}
                  />
                ) : null}
                {drawPreview ? (
                  <div
                    data-proto-skip
                    className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/5"
                    style={{ left: drawPreview.x, top: drawPreview.y, width: drawPreview.w, height: drawPreview.h }}
                  />
                ) : null}
                {scopeOverlay}
                {commentPins.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    data-proto-skip
                    className={cn(
                      "absolute z-30 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold shadow",
                      pin.resolved ? "bg-muted text-muted-foreground" : "bg-amber-500 text-amber-950",
                    )}
                    style={{ left: pin.x, top: pin.y }}
                    title={t("protoCommentPin")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCommentPinClick?.(pin.id);
                    }}
                  >
                    {pin.number}
                  </button>
                ))}
                {placed.map(({ element: el, absX, absY }) => {
                  const active = selected.includes(el.id);
                  const mark = notes.get(el.id);
                  const locked = el.locked === true;
                  return (
                    <div
                      key={el.id}
                      data-el={el.id}
                      className={cn("absolute overflow-visible outline outline-1 outline-transparent hover:outline-primary", active && "z-10 outline-2 outline-primary", locked && "opacity-80")}
                      style={{ left: absX, top: absY, width: el.w, height: el.h, ...wireframeElementBoxStyle(el, "base", styleLibrary) }}
                    >
                      <div className="size-full overflow-hidden">
                        <ElementFace
                          el={edit?.id === el.id ? applyInlineDraft(el, edit) : el}
                          allElements={elements}
                          components={components}
                          resolveAsset={resolveAsset}
                          styleLibrary={styleLibrary}
                          fidelity={fidelity}
                        />
                      </div>
                      {badges ? (
                        <span className={cn("pointer-events-none absolute bottom-full left-0 mb-0.5 max-w-full truncate rounded-sm px-1 text-[9px] leading-3", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          {el.type} · {el.label}
                        </span>
                      ) : null}
                      {mark !== undefined ? (
                        <span className="pointer-events-none absolute bottom-full right-0 mb-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground">{mark}</span>
                      ) : null}
                      {elementHasInteractions(el) ? (
                        <span className="pointer-events-none absolute right-0 top-0 flex size-4 items-center justify-center rounded-bl bg-amber-500 text-amber-950" title={t("protoIxBadge")}>
                          <Icon name="Zap" className="size-3" />
                        </span>
                      ) : null}
                      {edit?.id === el.id ? (
                        <input
                          ref={editInputRef}
                          data-proto-skip
                          className="absolute z-20 border border-primary bg-background px-1 text-sm outline-none"
                          style={editOverlayBox(el, edit.target)}
                          value={edit.draft}
                          onChange={(event) => onEditChange(event.target.value)}
                          onKeyDown={onInlineKeyDown}
                          onPointerDown={(event) => event.stopPropagation()}
                          onBlur={() => { if (!skipBlur.current) onCommitEdit(); }}
                        />
                      ) : null}
                      {active && !locked ? (
                        <div data-proto-skip className="pointer-events-none absolute inset-0">
                          {one?.id === el.id
                            ? HANDLES.map((handle) => (
                                <span key={handle} data-handle={handle} className={cn("pointer-events-auto absolute size-2.5 rounded-sm border border-primary bg-background", HANDLE_CLASS[handle])} />
                              ))
                            : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <ConnectorsLayer
                  elements={elements}
                  selected={selected}
                  connectorTool={connectorTool}
                  hoverElementId={connectorHoverId}
                  draftLine={connectorDraft}
                />
                {one && isAutoLayoutStack(one) ? (
                  <div data-proto-skip className="pointer-events-none absolute inset-0 z-20">
                    {stackLayoutHandleMarkers(one, elements).map((marker) => (
                      <span
                        key={marker.key}
                        data-stack-handle={marker.stackHandle}
                        className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-pink-600 bg-pink-200 shadow-sm"
                        style={{ left: marker.x, top: marker.y }}
                      />
                    ))}
                  </div>
                ) : null}
                {one && isConnector(one) ? (
                  <div data-proto-skip className="pointer-events-none absolute inset-0 z-20">
                    {(() => {
                      const handles = connectorHandlePoints(one, elements);
                      return (
                        <>
                          <span data-connector-handle="start" className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-background" style={{ left: handles.start.x, top: handles.start.y }} />
                          <span data-connector-handle="end" className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-background" style={{ left: handles.end.x, top: handles.end.y }} />
                          {handles.bend ? (
                            <span data-connector-handle="bend" className="pointer-events-auto absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-primary bg-background" style={{ left: handles.bend.x, top: handles.bend.y }} />
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                ) : null}
                {moveTooltip ? (
                  <div
                    data-proto-skip
                    className="pointer-events-none absolute z-30 rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background"
                    style={{ left: moveTooltip.x, top: Math.max(0, moveTooltip.y - 20) }}
                  >
                    {Math.round(moveTooltip.x)}, {Math.round(moveTooltip.y)} · {Math.round(moveTooltip.w)}×{Math.round(moveTooltip.h)}
                  </div>
                ) : null}
                <div data-proto-skip className="pointer-events-none absolute bottom-2 left-2 right-2 z-30 flex items-end justify-between gap-2">
                  {modifierHint ? (
                    <span className="max-w-[min(100%,28rem)] rounded-md bg-foreground/90 px-2 py-1 text-[10px] text-background shadow-sm">
                      {modifierHint}
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-end gap-2">
                    {minimapVisible && minimapViewport && onMinimapJump ? (
                      <CanvasMinimap canvas={canvas} elements={elements} viewport={minimapViewport} onJump={onMinimapJump} />
                    ) : null}
                    <button
                      type="button"
                      data-proto-skip
                      className="pointer-events-auto size-7 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground shadow-sm hover:bg-state-hover"
                      title={t("protoTourOpen")}
                      onClick={() => (onOpenTour ?? onOpenShortcuts)()}
                    >
                      ?
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
