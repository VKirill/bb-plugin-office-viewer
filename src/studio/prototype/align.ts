// Align and distribute selected wireframe elements; positions snap to the grid.
import { snap, type WireframeElement } from "./model.ts";

export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

type Box = { x: number; y: number; w: number; h: number };

function boundsOf(els: readonly Box[]): Box {
  const left = Math.min(...els.map((el) => el.x));
  const top = Math.min(...els.map((el) => el.y));
  const right = Math.max(...els.map((el) => el.x + el.w));
  const bottom = Math.max(...els.map((el) => el.y + el.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function aligned(el: WireframeElement, edge: AlignEdge, frame: Box): WireframeElement {
  switch (edge) {
    case "left":
      return { ...el, x: snap(frame.x) };
    case "right":
      return { ...el, x: snap(frame.x + frame.w - el.w) };
    case "center":
      return { ...el, x: snap(frame.x + (frame.w - el.w) / 2) };
    case "top":
      return { ...el, y: snap(frame.y) };
    case "bottom":
      return { ...el, y: snap(frame.y + frame.h - el.h) };
    case "middle":
      return { ...el, y: snap(frame.y + (frame.h - el.h) / 2) };
  }
}

export function alignElements(
  elements: readonly WireframeElement[],
  ids: readonly string[],
  edge: AlignEdge,
  canvas?: { width: number; height: number },
): WireframeElement[] {
  const chosen = elements.filter((el) => ids.includes(el.id));
  if (chosen.length === 0) return [...elements];
  const frame =
    chosen.length === 1 && canvas
      ? { x: 0, y: 0, w: canvas.width, h: canvas.height }
      : chosen.length === 1
        ? null
        : boundsOf(chosen);
  if (!frame) return [...elements];
  const want = new Set(ids);
  return elements.map((el) => (want.has(el.id) ? aligned(el, edge, frame) : el));
}

export function distributeElements(
  elements: readonly WireframeElement[],
  ids: readonly string[],
  axis: DistributeAxis,
): WireframeElement[] {
  const chosen = elements.filter((el) => ids.includes(el.id));
  if (chosen.length < 3) return [...elements];
  const horizontal = axis === "horizontal";
  const ordered = [...chosen].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const start = horizontal ? first.x : first.y;
  const end = horizontal ? last.x + last.w : last.y + last.h;
  const total = ordered.reduce((sum, el) => sum + (horizontal ? el.w : el.h), 0);
  const gap = (end - start - total) / (ordered.length - 1);
  const next = new Map<string, number>();
  let cursor = start;
  for (const el of ordered) {
    next.set(el.id, snap(cursor));
    cursor += (horizontal ? el.w : el.h) + gap;
  }
  return elements.map((el) => {
    const pos = next.get(el.id);
    if (pos === undefined) return el;
    return horizontal ? { ...el, x: pos } : { ...el, y: pos };
  });
}
