// Virtualized sheet grid: column letters and row numbers stay pinned, an
// optional frozen first row, merged cells, selection and search highlights.
// Only the cells inside the viewport are rendered, so large sheets scroll freely.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { columnName, type Merge, type Sheet } from "./sheet";

export const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 24;
const OVERSCAN = 4;

export type Position = { row: number; col: number };

export type GridHandle = { reveal(position: Position): void; focus(): void };

type Props = {
  sheet: Sheet;
  freeze: boolean;
  selected: Position | null;
  onSelect(position: Position): void;
  matches: Set<number>;
  current: Position | null;
  onCopy(): void;
  onOpenLink(url: string): void;
  linkHint: string;
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

export const cellKey = (sheet: Sheet, row: number, col: number) => row * sheet.cols + col;

export const Grid = forwardRef<GridHandle, Props>(function Grid({ sheet, freeze, selected, onSelect, matches, current, onCopy, onOpenLink, linkHint }, ref) {
  const body = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const frozen = freeze && sheet.rows > 1 ? 1 : 0;
  const gutter = Math.max(40, String(sheet.rows).length * 8 + 16);

  const offsets = useMemo(() => {
    const result = [0];
    for (const width of sheet.widths) result.push(result[result.length - 1] + width);
    return result;
  }, [sheet]);

  // Merge origins and the cells they cover (skipped when rendering).
  const { origins, covered } = useMemo(() => {
    const origins = new Map<number, Merge>();
    const covered = new Set<number>();
    for (const merge of sheet.merges) {
      origins.set(cellKey(sheet, merge.r1, merge.c1), merge);
      if ((merge.r2 - merge.r1 + 1) * (merge.c2 - merge.c1 + 1) > 50_000) continue;
      for (let r = merge.r1; r <= merge.r2; r++) {
        for (let c = merge.c1; c <= merge.c2; c++) if (r !== merge.r1 || c !== merge.c1) covered.add(cellKey(sheet, r, c));
      }
    }
    return { origins, covered };
  }, [sheet]);

  const measure = useCallback(() => {
    const el = body.current;
    if (el) setScroll({ top: el.scrollTop, left: el.scrollLeft, width: el.clientWidth, height: el.clientHeight });
  }, []);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sheet, measure]);

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

  useImperativeHandle(ref, () => ({ focus: () => body.current?.focus({ preventScroll: true }), reveal }), [reveal]);

  const bodyRows = sheet.rows - frozen;
  const firstRow = Math.max(0, Math.floor(scroll.top / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(bodyRows - 1, Math.ceil((scroll.top + scroll.height) / ROW_HEIGHT) + OVERSCAN);
  const firstCol = sheet.cols ? Math.max(0, locateIndex(offsets, scroll.left) - 1) : 0;
  const lastCol = sheet.cols ? Math.min(sheet.cols - 1, locateIndex(offsets, scroll.left + scroll.width) + 1) : -1;

  const renderCell = (row: number, col: number, top: number, width: number, height: number) => {
    const cell = sheet.cell(row, col);
    const key = cellKey(sheet, row, col);
    const isSelected = selected?.row === row && selected.col === col;
    const isCurrent = current?.row === row && current.col === col;
    return (
      <div
        key={key}
        role="gridcell"
        aria-selected={isSelected}
        title={cell?.link ? linkHint : undefined}
        onMouseDown={(event) => {
          if (cell?.link && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onOpenLink(cell.link);
          }
          onSelect({ row, col });
        }}
        className={cn(
          "absolute truncate border-b border-r border-border bg-background px-1.5 text-xs leading-6 text-foreground",
          cell?.numeric && "text-right tabular-nums",
          cell?.link && "cursor-pointer text-sky-600 underline decoration-sky-600/40 dark:text-sky-400",
          matches.has(key) && "bg-amber-500/15",
          isCurrent && "bg-amber-500/40",
          isSelected && "z-[1] outline outline-2 -outline-offset-2 outline-sky-500",
        )}
        style={{ top, left: offsets[col], width, height }}
      >
        {cell?.text}
      </div>
    );
  };

  const renderRow = (row: number, top: number) => {
    const cells = [];
    for (let col = firstCol; col <= lastCol; col++) {
      const key = cellKey(sheet, row, col);
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

  const bodyCells = [];
  for (let r = firstRow; r <= lastRow; r++) bodyCells.push(...renderRow(r + frozen, r * ROW_HEIGHT));

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && selected && !window.getSelection()?.toString()) {
      event.preventDefault();
      onCopy();
      return;
    }
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, event.shiftKey ? -1 : 1], Enter: [event.shiftKey ? -1 : 1, 0] };
    const move = moves[event.key];
    if (!move || !sheet.cols) return;
    event.preventDefault();
    const from = selected ?? { row: 0, col: 0 };
    const next = { row: Math.min(sheet.rows - 1, Math.max(0, from.row + move[0])), col: Math.min(sheet.cols - 1, Math.max(0, from.col + move[1])) };
    onSelect(next);
    reveal(next);
  };

  const headerTop = HEADER_HEIGHT + frozen * ROW_HEIGHT;
  const gutterCell = "absolute flex items-center justify-end border-b border-r border-border bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground";

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-background" role="grid" aria-rowcount={sheet.rows} aria-colcount={sheet.cols}>
      <div className="absolute left-0 top-0 border-b border-r border-border bg-muted" style={{ width: gutter, height: HEADER_HEIGHT }} />
      <div className="absolute right-0 top-0 overflow-hidden" style={{ left: gutter, height: HEADER_HEIGHT }}>
        <div className="relative h-full" style={{ transform: `translateX(${-scroll.left}px)` }}>
          {Array.from({ length: Math.max(0, lastCol - firstCol + 1) }, (_, i) => firstCol + i).map((col) => (
            <div
              key={col}
              className={cn(
                "absolute top-0 flex h-full items-center justify-center border-b border-r border-border bg-muted text-[11px] text-muted-foreground",
                selected?.col === col && "text-foreground",
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
          <div className={gutterCell} style={{ left: 0, top: HEADER_HEIGHT, width: gutter, height: ROW_HEIGHT }}>1</div>
          <div className="absolute right-0 overflow-hidden border-b border-border shadow-sm" style={{ left: gutter, top: HEADER_HEIGHT, height: ROW_HEIGHT }}>
            <div className="relative h-full font-medium" style={{ transform: `translateX(${-scroll.left}px)` }}>
              {renderRow(0, 0)}
              {renderMerges("frozen")}
            </div>
          </div>
        </>
      ) : null}

      <div className="absolute bottom-0 left-0 overflow-hidden" style={{ top: headerTop, width: gutter }}>
        <div className="relative" style={{ transform: `translateY(${-scroll.top}px)` }}>
          {Array.from({ length: Math.max(0, lastRow - firstRow + 1) }, (_, i) => firstRow + i).map((r) => (
            <div
              key={r}
              className={cn(gutterCell, selected?.row === r + frozen && "text-foreground")}
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
        </div>
      </div>
    </div>
  );
});
