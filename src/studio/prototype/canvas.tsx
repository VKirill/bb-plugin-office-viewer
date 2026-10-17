import type { DragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { applyInlineDraft, type InlineEdit } from "./editing";
import { ElementFace } from "./elements";
import { HANDLE_CLASS, HANDLES, editOverlayBox } from "./builder-geometry";
import { cn } from "@/lib/utils";
import { t } from "../../shared/i18n";
import { SNAP, type WireframeCanvas, type WireframeElement, type WireframePage } from "./model";

export function PrototypeCanvas({
  canvasPaneRef,
  boardRef,
  openTabs,
  activePageId,
  onSelectPage,
  onCloseTab,
  canvas,
  elements,
  zoom,
  badges,
  notes,
  selected,
  one,
  edit,
  editInputRef,
  selectionBand,
  onBoardPointerDown,
  onBoardPointerMove,
  onBoardPointerUp,
  onBoardDoubleClick,
  onDrop,
  onEditChange,
  onInlineKeyDown,
  onCommitEdit,
  skipBlur,
  onPaneClick,
}: {
  canvasPaneRef: RefObject<HTMLDivElement | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  openTabs: WireframePage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onCloseTab: (id: string) => void;
  canvas: WireframeCanvas;
  elements: WireframeElement[];
  zoom: number;
  badges: boolean;
  notes: Map<string, number>;
  selected: string[];
  one: WireframeElement | null;
  edit: InlineEdit | null;
  editInputRef: RefObject<HTMLInputElement | null>;
  selectionBand: { left: number; top: number; right: number; bottom: number } | null;
  onBoardPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoardDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onEditChange: (draft: string) => void;
  onInlineKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onCommitEdit: () => void;
  skipBlur: React.MutableRefObject<boolean>;
  onPaneClick: () => void;
}) {
  const ticks = (max: number, step = 100) => {
    const out: number[] = [];
    for (let v = 0; v <= max; v += step) out.push(v);
    return out;
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border bg-background px-2 py-1">
        {openTabs.map((page) => (
          <button
            key={page.id}
            type="button"
            className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs", page.id === activePageId ? "bg-muted font-medium" : "text-muted-foreground hover:bg-state-hover")}
            onClick={() => onSelectPage(page.id)}
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
      <div ref={canvasPaneRef} className="min-h-0 flex-1 overflow-auto bg-muted/40 p-4" onClick={onPaneClick}>
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
                className="relative shrink-0 shadow-sm"
                style={{ width: canvas.width, height: canvas.height, background: canvas.background, transform: `scale(${zoom})`, transformOrigin: "top left" }}
                onPointerDown={onBoardPointerDown}
                onPointerMove={onBoardPointerMove}
                onPointerUp={onBoardPointerUp}
                onPointerCancel={onBoardPointerUp}
                onDoubleClick={onBoardDoubleClick}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
              >
                <div
                  data-proto-skip
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: "linear-gradient(to right, color-mix(in oklab, var(--border) 35%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 35%, transparent) 1px, transparent 1px)",
                    backgroundSize: `${SNAP}px ${SNAP}px`,
                  }}
                />
                {elements.length === 0 ? (
                  <div data-proto-skip className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">{t("protoEmptyCanvas")}</div>
                ) : null}
                {elements.filter((el) => !el.hidden).map((el) => {
                  const active = selected.includes(el.id);
                  const mark = notes.get(el.id);
                  const locked = el.locked === true;
                  return (
                    <div
                      key={el.id}
                      data-el={el.id}
                      className={cn("absolute overflow-visible outline outline-1 outline-transparent hover:outline-primary", active && "z-10 outline-2 outline-primary", locked && "opacity-80")}
                      style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
                    >
                      <div className="size-full overflow-hidden">
                        <ElementFace el={edit?.id === el.id ? applyInlineDraft(el, edit) : el} />
                      </div>
                      {badges ? (
                        <span className={cn("pointer-events-none absolute bottom-full left-0 mb-0.5 max-w-full truncate rounded-sm px-1 text-[9px] leading-3", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          {el.type} · {el.label}
                        </span>
                      ) : null}
                      {mark !== undefined ? (
                        <span className="pointer-events-none absolute bottom-full right-0 mb-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground">{mark}</span>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
