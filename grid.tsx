// Virtualized sheet grid: column letters and row numbers stay pinned, an
// optional frozen first row, merged cells, range selection, the fill handle,
// reference highlights and Point mode while a formula is being typed.
// Only the cells inside the viewport are rendered.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { columnName, type Merge, type Sheet } from "./sheet";
import { cellKey, inRange, toRange, type Position, type Range } from "./edits";
import { MAX_COL, MAX_ROW } from "./formula";

export const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 24;
const OVERSCAN = 4;

export type GridHandle = { reveal(position: Position): void; focus(): void };

type Props = {
  sheet: Sheet;
  freeze: boolean;
  anchor: Position | null;
  focus: Position | null;
  onSelect(anchor: Position, focus: Position): void;
  matches: Set<number>;
  current: Position | null;
  highlights: { range: Range; color: string }[];
  editable: boolean;
  /** Cell showing the in-place editor on this sheet, and the editor itself. */
  editing: Position | null;
  editor: ReactNode;
  /** A formula is being typed and the caret accepts a reference. */
  pointing: boolean;
  onPoint(anchor: Position, focus: Position): void;
  onStartEdit(position: Position, initial?: string): void;
  onCommitEdit(): void;
  onClear(): void;
  onUndo(): void;
  onRedo(): void;
  onCopy(cut: boolean): string | null;
  onPaste(text: string): void;
  onFill(source: Range, target: Range): void;
  onOpenLink(url: string): void;
  hints: { link: string; unsupported: string };
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
  const { sheet, freeze, anchor, focus, onSelect, matches, current, editing, editable, pointing } = props;
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<"select" | "point" | "fill" | null>(null);
  const pointAnchor = useRef<Position | null>(null);
  const [fillTarget, setFillTarget] = useState<Range | null>(null);
  const fillRef = useRef<{ source: Range; target: Range } | null>(null);
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

  const onFill = props.onFill;
  useEffect(() => {
    const stop = () => {
      if (drag.current === "fill" && fillRef.current) {
        const { source, target } = fillRef.current;
        if (target.r1 !== source.r1 || target.r2 !== source.r2 || target.c1 !== source.c1 || target.c2 !== source.c2) onFill(source, target);
      }
      drag.current = null;
      fillRef.current = null;
      setFillTarget(null);
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, [onFill]);

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

  const pressCell = (event: MouseEvent, position: Position) => {
    if (editing && editing.row === position.row && editing.col === position.col) return;
    if (pointing && event.button === 0) {
      event.preventDefault();
      drag.current = "point";
      pointAnchor.current = event.shiftKey && pointAnchor.current ? pointAnchor.current : position;
      props.onPoint(pointAnchor.current, position);
      return;
    }
    if (event.button === 2) {
      if (!range || !inRange(range, position.row, position.col)) onSelect(position, position);
      return;
    }
    if (event.button !== 0) return;
    if (editing) props.onCommitEdit();
    drag.current = "select";
    if (event.shiftKey && anchor) onSelect(anchor, position);
    else onSelect(position, position);
  };

  const enterCell = (position: Position) => {
    if (drag.current === "select" && anchor) onSelect(anchor, position);
    else if (drag.current === "point" && pointAnchor.current) props.onPoint(pointAnchor.current, position);
    else if (drag.current === "fill" && fillRef.current) {
      const { source } = fillRef.current;
      const dr = position.row < source.r1 ? position.row - source.r1 : position.row > source.r2 ? position.row - source.r2 : 0;
      const dc = position.col < source.c1 ? position.col - source.c1 : position.col > source.c2 ? position.col - source.c2 : 0;
      const target =
        Math.abs(dr) >= Math.abs(dc)
          ? { ...source, r1: Math.min(source.r1, position.row), r2: Math.max(source.r2, position.row) }
          : { ...source, c1: Math.min(source.c1, position.col), c2: Math.max(source.c2, position.col) };
      fillRef.current = { source, target };
      setFillTarget(target);
    }
  };

  const renderCell = (row: number, col: number, top: number, width: number, height: number) => {
    const cell = sheet.cell(row, col);
    const key = cellKey(sheet.cols, row, col);
    const bareFormula = Boolean(cell?.formula) && cell?.text === "";
    return (
      <div
        key={key}
        role="gridcell"
        data-cell={`${columnName(col)}${row + 1}`}
        aria-selected={range ? inRange(range, row, col) : false}
        title={cell?.unsupported ? props.hints.unsupported : cell?.link ? props.hints.link : undefined}
        onMouseDown={(event) => {
          if (!pointing && event.button === 0 && cell?.link && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            props.onOpenLink(cell.link);
          }
          pressCell(event, { row, col });
        }}
        onMouseEnter={() => enterCell({ row, col })}
        onDoubleClick={() => editable && !pointing && props.onStartEdit({ row, col })}
        className={cn(
          "absolute select-none truncate border-b border-r border-border bg-background px-1.5 text-xs leading-6 text-foreground",
          cell?.numeric && "text-right tabular-nums",
          cell?.link && "cursor-pointer text-sky-600 underline decoration-sky-600/40 dark:text-sky-400",
          (cell?.unsupported || bareFormula) && "italic text-muted-foreground",
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

  /** A rectangle over sheet rows [from, to] of one layer, clipped to the sheet. */
  const box = (r: Range, from: number, to: number, rowOffset: number) => {
    const r1 = Math.max(r.r1, from);
    const r2 = Math.min(r.r2, to, sheet.rows - 1);
    const c2 = Math.min(r.c2, sheet.cols - 1);
    if (r1 > r2 || r.c1 > c2) return null;
    return { top: (r1 - rowOffset) * ROW_HEIGHT, left: offsets[r.c1], width: offsets[c2 + 1] - offsets[r.c1], height: (r2 - r1 + 1) * ROW_HEIGHT };
  };

  const renderOverlays = (from: number, to: number, rowOffset: number) => {
    const parts: ReactNode[] = [];
    props.highlights.forEach((highlight, i) => {
      const rect = box(highlight.range, from, to, rowOffset);
      if (rect) parts.push(<div key={`hl${i}`} className="pointer-events-none absolute z-[2] border-2" style={{ ...rect, borderColor: highlight.color, backgroundColor: `${highlight.color}14` }} />);
    });
    if (range && anchor) {
      const rect = box(range, from, to, rowOffset);
      if (rect && (range.r1 !== range.r2 || range.c1 !== range.c2)) parts.push(<div key="range" className="pointer-events-none absolute z-[2] border border-sky-500 bg-sky-500/10" style={rect} />);
      const active = box({ r1: anchor.row, c1: anchor.col, r2: anchor.row, c2: anchor.col }, from, to, rowOffset);
      if (active && !editing) parts.push(<div key="active" className="pointer-events-none absolute z-[3] border-2 border-sky-500" style={active} />);
      const corner = box({ r1: range.r2, c1: range.c2, r2: range.r2, c2: range.c2 }, from, to, rowOffset);
      if (corner && editable && !editing && range.r2 < sheet.rows && range.c2 < sheet.cols) {
        parts.push(
          <div
            key="fill"
            role="presentation"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              drag.current = "fill";
              fillRef.current = { source: range, target: range };
              setFillTarget(range);
            }}
            className="absolute z-[4] size-[7px] cursor-crosshair border border-background bg-sky-500"
            style={{ top: corner.top + corner.height - 4, left: corner.left + corner.width - 4 }}
          />,
        );
      }
    }
    if (fillTarget) {
      const rect = box(fillTarget, from, to, rowOffset);
      if (rect) parts.push(<div key="fillTarget" className="pointer-events-none absolute z-[3] border border-dashed border-foreground/70" style={rect} />);
    }
    if (editing && editing.row >= from && editing.row <= to) {
      const rect = box({ r1: editing.row, c1: editing.col, r2: editing.row, c2: editing.col }, from, to, rowOffset);
      if (rect) {
        parts.push(
          <div key="editor" className="absolute z-[5] border-2 border-sky-500 bg-background shadow-md" style={{ top: rect.top, left: rect.left, minWidth: Math.max(rect.width, 200), height: ROW_HEIGHT }}>
            {props.editor}
          </div>,
        );
      }
    }
    return parts;
  };

  const bodyCells = [];
  for (let r = firstRow; r <= lastRow; r++) bodyCells.push(...renderRow(r + frozen, r * ROW_HEIGHT));

  const clamp = (position: Position): Position => ({
    row: Math.min(sheet.rows - 1, Math.max(0, position.row)),
    col: Math.min(sheet.cols - 1, Math.max(0, position.col)),
  });

  /** Ctrl/⌘+arrow: to the edge of the current block of data, or the next block. */
  const edge = (from: Position, dr: number, dc: number): Position => {
    const filled = (p: Position) => sheet.cell(p.row, p.col) !== null;
    let position = from;
    const next = () => clamp({ row: position.row + dr, col: position.col + dc });
    const atLimit = () => { const n = next(); return n.row === position.row && n.col === position.col; };
    if (atLimit()) return position;
    const startFilled = filled(position) && filled(next());
    if (startFilled) {
      while (!atLimit() && filled(next())) position = next();
    } else {
      position = next();
      while (!atLimit() && !filled(position)) position = next();
    }
    return position;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (editing || !sheet.cols) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === "a") {
      event.preventDefault();
      onSelect({ row: 0, col: 0 }, { row: sheet.rows - 1, col: sheet.cols - 1 });
      return;
    }
    if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
      event.preventDefault();
      props.onRedo();
      return;
    }
    if (mod && key === "z") {
      event.preventDefault();
      props.onUndo();
      return;
    }
    if (!anchor) return;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dr, dc] = arrows[event.key];
      const from = event.shiftKey ? (focus ?? anchor) : anchor;
      const next = mod ? edge(from, dr, dc) : clamp({ row: from.row + dr, col: from.col + dc });
      if (event.shiftKey) onSelect(anchor, next);
      else onSelect(next, next);
      reveal(next);
      return;
    }
    if (mod) return;
    if (editable && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      props.onClear();
      return;
    }
    if (editable && (event.key === "F2" || (event.key === "Enter" && event.altKey))) {
      event.preventDefault();
      props.onStartEdit(anchor);
      return;
    }
    if (editable && event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      props.onStartEdit(anchor, event.key);
      return;
    }
    const steps: Record<string, [number, number]> = { Tab: [0, event.shiftKey ? -1 : 1], Enter: [event.shiftKey ? -1 : 1, 0] };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    const next = clamp({ row: anchor.row + step[0], col: anchor.col + step[1] });
    onSelect(next, next);
    reveal(next);
  };

  const pressColumn = (event: MouseEvent, col: number) => {
    if (pointing && event.button === 0) {
      event.preventDefault();
      props.onPoint({ row: 0, col }, { row: MAX_ROW, col });
      return;
    }
    const whole = range !== null && col >= range.c1 && col <= range.c2 && range.r1 === 0 && range.r2 === sheet.rows - 1;
    if (event.button === 2) {
      if (!whole) onSelect({ row: 0, col }, { row: sheet.rows - 1, col });
      return;
    }
    if (editing) props.onCommitEdit();
    const from = event.shiftKey && anchor ? anchor.col : col;
    onSelect({ row: 0, col: from }, { row: sheet.rows - 1, col });
  };

  const pressRow = (event: MouseEvent, row: number) => {
    if (pointing && event.button === 0) {
      event.preventDefault();
      props.onPoint({ row, col: 0 }, { row, col: MAX_COL });
      return;
    }
    const whole = range !== null && row >= range.r1 && row <= range.r2 && range.c1 === 0 && range.c2 === sheet.cols - 1;
    if (event.button === 2) {
      if (!whole) onSelect({ row, col: 0 }, { row, col: sheet.cols - 1 });
      return;
    }
    if (editing) props.onCommitEdit();
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
              onMouseDown={(event) => pressColumn(event, col)}
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
          <div className={cn(gutterCell, rowSelected(0) && "bg-accent text-foreground")} style={{ left: 0, top: HEADER_HEIGHT, width: gutter, height: ROW_HEIGHT }} onMouseDown={(event) => pressRow(event, 0)}>1</div>
          <div className="absolute right-0 z-[6] overflow-visible border-b border-border shadow-sm" style={{ left: gutter, top: HEADER_HEIGHT, height: ROW_HEIGHT, clipPath: "inset(0 0 -400px 0)" }}>
            <div className="relative h-full font-medium" style={{ transform: `translateX(${-scroll.left}px)` }}>
              {renderRow(0, 0)}
              {renderMerges("frozen")}
              {renderOverlays(0, frozen - 1, 0)}
            </div>
          </div>
        </>
      ) : null}

      <div className="absolute bottom-0 left-0 overflow-hidden" style={{ top: headerTop, width: gutter }}>
        <div className="relative" style={{ transform: `translateY(${-scroll.top}px)` }}>
          {Array.from({ length: Math.max(0, lastRow - firstRow + 1) }, (_, i) => firstRow + i).map((r) => (
            <div
              key={r}
              onMouseDown={(event) => pressRow(event, r + frozen)}
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
        onCopy={(event) => {
          if (editing) return;
          const text = props.onCopy(false);
          if (text === null) return;
          event.preventDefault();
          event.clipboardData.setData("text/plain", text);
        }}
        onCut={(event) => {
          if (editing || !editable) return;
          const text = props.onCopy(true);
          if (text === null) return;
          event.preventDefault();
          event.clipboardData.setData("text/plain", text);
        }}
        onPaste={(event) => {
          if (editing || !editable) return;
          event.preventDefault();
          props.onPaste(event.clipboardData.getData("text/plain"));
        }}
        className="absolute bottom-0 right-0 overflow-auto outline-none"
        style={{ top: headerTop, left: gutter }}
      >
        <div className="relative" style={{ width: offsets[offsets.length - 1], height: bodyRows * ROW_HEIGHT }}>
          {bodyCells}
          {renderMerges("body")}
          {renderOverlays(frozen, sheet.rows - 1, frozen)}
        </div>
      </div>
    </div>
  );
});
