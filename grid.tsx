// Virtualized sheet grid: column letters and row numbers stay pinned, an
// optional frozen first row, merged cells, range selection, in-cell editing
// and search highlights. Only the cells inside the viewport are rendered.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { columnName, type Merge, type Sheet } from "./sheet";
import { cellKey, inRange, toRange, type Position, type Range } from "./edits";

export const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 24;
const OVERSCAN = 4;

export type GridHandle = { reveal(position: Position): void; focus(): void };

export type Editing = { row: number; col: number; draft: string };

type Props = {
  sheet: Sheet;
  freeze: boolean;
  anchor: Position | null;
  focus: Position | null;
  onSelect(anchor: Position, focus: Position): void;
  matches: Set<number>;
  current: Position | null;
  isStale(row: number, col: number): boolean;
  isEdited(row: number, col: number): boolean;
  editable: boolean;
  editing: Editing | null;
  onStartEdit(position: Position, initial?: string): void;
  onDraft(text: string): void;
  onCommitEdit(move: [number, number] | null): void;
  onCancelEdit(): void;
  onClear(): void;
  onCopy(): void;
  onUndo(): void;
  onOpenLink(url: string): void;
  hints: { link: string; stale: string };
};

/** Index of the last offset <= x. */
function locateIndex(offsets: number[], x: number) {
  let lo = 0;
  let hi = offsets.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

export const Grid = forwardRef<GridHandle, Props>(function Grid(props, ref) {
  const { sheet, freeze, anchor, focus, onSelect, matches, current, editing, editable } = props;
  const body = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [scroll, setScroll] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const frozen = freeze && sheet.rows > 1 ? 1 : 0;
  const gutter = Math.max(40, String(sheet.rows).length * 8 + 16);
  const range: Range | null = anchor && focus ? toRange(anchor, focus) : null;

  const offsets = useMemo(() => {
    const result = [0];
    for (const width of sheet.widths) result.push(result[result.length - 1] + width);
    return result;
  }, [sheet.widths]);

  // Merge origins and the cells they cover (skipped when rendering).
  const { origins, covered } = useMemo(() => {
    const origins = new Map<number, Merge>();
    const covered = new Set<number>();
    for (const merge of sheet.merges) {
      origins.set(cellKey(sheet.cols, merge.r1, merge.c1), merge);
      if ((merge.r2 - merge.r1 + 1) * (merge.c2 - merge.c1 + 1) > 50_000) continue;
      for (let r = merge.r1; r <= merge.r2; r++) {
        for (let c = merge.c1; c <= merge.c2; c++) if (r !== merge.r1 || c !== merge.c1) covered.add(cellKey(sheet.cols, r, c));
      }
    }
    return { origins, covered };
  }, [sheet.merges, sheet.cols]);

  const measure = useCallback(() => {
    const el = body.current;
    if (el) setScroll({ top: el.scrollTop, left: el.scrollLeft, width: el.clientWidth, height: el.clientHeight });
  }, []);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
    measure();
  }, [sheet.name, measure]);

  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const frame = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(measure);
  };

  const reveal = useCallback(({ row, col }: Position) => {
    const el = body.current;
    if (!el) return;
    if (row >= frozen) {
      const top = (row - frozen) * ROW_HEIGHT;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
    }
    const left = offsets[col];
    const right = offsets[col + 1];
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.min(left, right - el.clientWidth);
  }, [frozen, offsets]);

  const focusGrid = useCallback(() => body.current?.focus({ preventScroll: true }), []);
  useImperativeHandle(ref, () => ({ focus: focusGrid, reveal }), [focusGrid, reveal]);

  useEffect(() => {
    if (!editing) focusGrid();
  }, [editing === null, focusGrid]); // eslint-disable-line react-hooks/exhaustive-deps

  const bodyRows = sheet.rows - frozen;
  const firstRow = Math.max(0, Math.floor(scroll.top / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(bodyRows - 1, Math.ceil((scroll.top + scroll.height) / ROW_HEIGHT) + OVERSCAN);
  const firstCol = sheet.cols ? Math.max(0, locateIndex(offsets, scroll.left) - 1) : 0;
  const lastCol = sheet.cols ? Math.min(sheet.cols - 1, locateIndex(offsets, scroll.left + scroll.width) + 1) : -1;

  const pointAt = (event: MouseEvent, position: Position) => {
    if (event.button === 2) {
      if (!range || !inRange(range, position.row, position.col)) onSelect(position, position);
      return;
    }
    if (event.button !== 0) return;
    if (editing) props.onCommitEdit(null);
    dragging.current = true;
    if (event.shiftKey && anchor) onSelect(anchor, position);
    else onSelect(position, position);
  };

  const renderCell = (row: number, col: number, top: number, width: number, height: number) => {
    const cell = sheet.cell(row, col);
    const key = cellKey(sheet.cols, row, col);
    const stale = cell?.formula ? props.isStale(row, col) : false;
    const bareFormula = Boolean(cell?.formula) && cell?.text === "";
    return (
      <div
        key={key}
        role="gridcell"
        aria-selected={range ? inRange(range, row, col) : false}
        title={stale || bareFormula ? props.hints.stale : cell?.link ? props.hints.link : undefined}
        onMouseDown={(event) => {
          if (event.button === 0 && cell?.link && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            props.onOpenLink(cell.link);
          }
          pointAt(event, { row, col });
        }}
        onMouseEnter={() => {
          if (dragging.current && anchor) onSelect(anchor, { row, col });
        }}
        onDoubleClick={() => editable && props.onStartEdit({ row, col })}
        className={cn(
          "absolute select-none truncate border-b border-r border-border bg-background px-1.5 text-xs leading-6 text-foreground",
          cell?.numeric && "text-right tabular-nums",
          cell?.link && "cursor-pointer text-sky-600 underline decoration-sky-600/40 dark:text-sky-400",
          (stale || bareFormula) && "italic text-muted-foreground",
          props.isEdited(row, col) && "shadow-[inset_3px_0_0_0_rgb(16_185_129)]",
          matches.has(key) && "bg-amber-500/15",
          current?.row === row && current.col === col && "bg-amber-500/40",
        )}
        style={{ top, left: offsets[col], width, height }}
      >
        {bareFormula ? cell?.formula : cell?.text}
      </div>
    );
  };

  const renderRow = (row: number, top: number) => {
    const cells = [];
    for (let col = firstCol; col <= lastCol; col++) {
      const key = cellKey(sheet.cols, row, col);
      if (covered.has(key) || origins.has(key)) continue;
      cells.push(renderCell(row, col, top, sheet.widths[col], ROW_HEIGHT));
    }
    return cells;
  };

  // Merges intersecting the visible window render once at their full size.
  // In the frozen layer a merge is clipped to the frozen row.
  const renderMerges = (layer: "frozen" | "body") =>
    sheet.merges
      .filter((m) => m.c2 >= firstCol && m.c1 <= lastCol)
      .filter((m) => (layer === "frozen" ? m.r1 < frozen : m.r1 >= frozen && m.r1 <= lastRow + frozen && m.r2 >= firstRow + frozen))
      .map((m) => {
        const lastSpanRow = layer === "frozen" ? Math.min(m.r2, frozen - 1) : m.r2;
        return renderCell(m.r1, m.c1, (m.r1 - (layer === "frozen" ? 0 : frozen)) * ROW_HEIGHT, offsets[m.c2 + 1] - offsets[m.c1], (lastSpanRow - m.r1 + 1) * ROW_HEIGHT);
      });

  /** Selection rectangle and active cell for the sheet rows [from, to] of one layer. */
  const renderSelection = (from: number, to: number, rowOffset: number) => {
    if (!range || !anchor) return null;
    const r1 = Math.max(range.r1, from);
    const r2 = Math.min(range.r2, to);
    const parts = [];
    if (r1 <= r2 && (range.r1 !== range.r2 || range.c1 !== range.c2)) {
      parts.push(
        <div
          key="range"
          className="pointer-events-none absolute z-[2] border border-sky-500 bg-sky-500/10"
          style={{ top: (r1 - rowOffset) * ROW_HEIGHT, left: offsets[range.c1], width: offsets[range.c2 + 1] - offsets[range.c1], height: (r2 - r1 + 1) * ROW_HEIGHT }}
        />,
      );
    }
    if (anchor.row >= from && anchor.row <= to && !editing) {
      parts.push(
        <div
          key="active"
          className="pointer-events-none absolute z-[3] border-2 border-sky-500"
          style={{ top: (anchor.row - rowOffset) * ROW_HEIGHT, left: offsets[anchor.col], width: sheet.widths[anchor.col], height: ROW_HEIGHT }}
        />,
      );
    }
    return parts;
  };

  const renderEditor = (from: number, to: number, rowOffset: number) => {
    if (!editing || editing.row < from || editing.row > to) return null;
    return (
      <input
        autoFocus
        value={editing.draft}
        onChange={(event) => props.onDraft(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            props.onCommitEdit([event.shiftKey ? -1 : 1, 0]);
          } else if (event.key === "Tab") {
            event.preventDefault();
            props.onCommitEdit([0, event.shiftKey ? -1 : 1]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            props.onCancelEdit();
          }
        }}
        onBlur={() => props.onCommitEdit(null)}
        spellCheck={false}
        className="absolute z-[4] border-2 border-sky-500 bg-background px-1 text-xs text-foreground shadow-md outline-none"
        style={{ top: (editing.row - rowOffset) * ROW_HEIGHT, left: offsets[editing.col], minWidth: Math.max(sheet.widths[editing.col], 160), height: ROW_HEIGHT }}
      />
    );
  };

  const bodyCells = [];
  for (let r = firstRow; r <= lastRow; r++) bodyCells.push(...renderRow(r + frozen, r * ROW_HEIGHT));

  const move = (position: Position, dr: number, dc: number): Position => ({
    row: Math.min(sheet.rows - 1, Math.max(0, position.row + dr)),
    col: Math.min(sheet.cols - 1, Math.max(0, position.col + dc)),
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (editing || !sheet.cols) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === "c" && anchor) {
      event.preventDefault();
      props.onCopy();
      return;
    }
    if (mod && key === "a") {
      event.preventDefault();
      onSelect({ row: 0, col: 0 }, { row: sheet.rows - 1, col: sheet.cols - 1 });
      return;
    }
    if (mod && key === "z") {
      event.preventDefault();
      props.onUndo();
      return;
    }
    if (!anchor || mod) return;
    if (editable && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      props.onClear();
      return;
    }
    if (editable && event.key === "F2") {
      event.preventDefault();
      props.onStartEdit(anchor);
      return;
    }
    if (editable && event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      props.onStartEdit(anchor, event.key);
      return;
    }
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const steps: Record<string, [number, number]> = { Tab: [0, event.shiftKey ? -1 : 1], Enter: [event.shiftKey ? -1 : 1, 0] };
    const delta = arrows[event.key] ?? steps[event.key];
    if (!delta) return;
    event.preventDefault();
    if (arrows[event.key] && event.shiftKey) {
      const next = move(focus ?? anchor, ...delta);
      onSelect(anchor, next);
      reveal(next);
    } else {
      const next = move(anchor, ...delta);
      onSelect(next, next);
      reveal(next);
    }
  };

  const selectColumns = (event: MouseEvent, col: number) => {
    const whole = range !== null && col >= range.c1 && col <= range.c2 && range.r1 === 0 && range.r2 === sheet.rows - 1;
    if (event.button === 2) {
      if (!whole) onSelect({ row: 0, col }, { row: sheet.rows - 1, col });
      return;
    }
    const from = event.shiftKey && anchor ? anchor.col : col;
    onSelect({ row: 0, col: from }, { row: sheet.rows - 1, col });
  };

  const selectRows = (event: MouseEvent, row: number) => {
    const whole = range !== null && row >= range.r1 && row <= range.r2 && range.c1 === 0 && range.c2 === sheet.cols - 1;
    if (event.button === 2) {
      if (!whole) onSelect({ row, col: 0 }, { row, col: sheet.cols - 1 });
      return;
    }
    const from = event.shiftKey && anchor ? anchor.row : row;
    onSelect({ row: from, col: 0 }, { row, col: sheet.cols - 1 });
  };

  const headerTop = HEADER_HEIGHT + frozen * ROW_HEIGHT;
  const gutterCell = "absolute flex cursor-default select-none items-center justify-end border-b border-r border-border bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground";
  const rowSelected = (row: number) => range !== null && row >= range.r1 && row <= range.r2;
  const colSelected = (col: number) => range !== null && col >= range.c1 && col <= range.c2;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-background" role="grid" aria-rowcount={sheet.rows} aria-colcount={sheet.cols} data-bb-ru-skip="">
      <div
        className="absolute left-0 top-0 border-b border-r border-border bg-muted"
        style={{ width: gutter, height: HEADER_HEIGHT }}
        onMouseDown={() => sheet.cols && onSelect({ row: 0, col: 0 }, { row: sheet.rows - 1, col: sheet.cols - 1 })}
      />
      <div className="absolute right-0 top-0 overflow-hidden" style={{ left: gutter, height: HEADER_HEIGHT }}>
        <div className="relative h-full" style={{ transform: `translateX(${-scroll.left}px)` }}>
          {Array.from({ length: Math.max(0, lastCol - firstCol + 1) }, (_, i) => firstCol + i).map((col) => (
            <div
              key={col}
              onMouseDown={(event) => selectColumns(event, col)}
              className={cn(
                "absolute top-0 flex h-full cursor-default select-none items-center justify-center border-b border-r border-border bg-muted text-[11px] text-muted-foreground",
                colSelected(col) && "bg-accent text-foreground",
              )}
              style={{ left: offsets[col], width: sheet.widths[col] }}
            >
              {columnName(col)}
            </div>
          ))}
        </div>
      </div>

      {frozen ? (
        <>
          <div className={cn(gutterCell, rowSelected(0) && "bg-accent text-foreground")} style={{ left: 0, top: HEADER_HEIGHT, width: gutter, height: ROW_HEIGHT }} onMouseDown={(event) => selectRows(event, 0)}>1</div>
          <div className="absolute right-0 overflow-hidden border-b border-border shadow-sm" style={{ left: gutter, top: HEADER_HEIGHT, height: ROW_HEIGHT }}>
            <div className="relative h-full font-medium" style={{ transform: `translateX(${-scroll.left}px)` }}>
              {renderRow(0, 0)}
              {renderMerges("frozen")}
              {renderSelection(0, frozen - 1, 0)}
              {renderEditor(0, frozen - 1, 0)}
            </div>
          </div>
        </>
      ) : null}

      <div className="absolute bottom-0 left-0 overflow-hidden" style={{ top: headerTop, width: gutter }}>
        <div className="relative" style={{ transform: `translateY(${-scroll.top}px)` }}>
          {Array.from({ length: Math.max(0, lastRow - firstRow + 1) }, (_, i) => firstRow + i).map((r) => (
            <div
              key={r}
              onMouseDown={(event) => selectRows(event, r + frozen)}
              className={cn(gutterCell, rowSelected(r + frozen) && "bg-accent text-foreground")}
              style={{ top: r * ROW_HEIGHT, width: gutter, height: ROW_HEIGHT }}
            >
              {r + frozen + 1}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={body}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="absolute bottom-0 right-0 overflow-auto outline-none"
        style={{ top: headerTop, left: gutter }}
      >
        <div className="relative" style={{ width: offsets[offsets.length - 1], height: bodyRows * ROW_HEIGHT }}>
          {bodyCells}
          {renderMerges("body")}
          {renderSelection(frozen, sheet.rows - 1, frozen)}
          {renderEditor(frozen, sheet.rows - 1, frozen)}
        </div>
      </div>
    </div>
  );
});
