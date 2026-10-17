// Canvas geometry: marquee, snapping, groups, nudge, distances, zoom helpers.
import type { ElementType, WireframeElement } from "./model.ts";
import { SNAP, snap } from "./model.ts";

export const FINE_GRID = 10;
export const NUDGE_FINE = 1;
export const NUDGE_COARSE = 10;
export const SNAP_GUIDE_THRESHOLD = 5;

export type CanvasRect = { left: number; top: number; right: number; bottom: number };

export type SnapGuide = { axis: "x" | "y"; at: number; from: number; to: number };

export type DistanceLine = {
  axis: "x" | "y";
  from: number;
  to: number;
  at: number;
  gap: number;
};

export type QuickTool = {
  type: ElementType;
  props?: Record<string, string | number | boolean | string[]>;
};

export const CANVAS_TOOL_KEYS: Record<string, QuickTool> = {
  r: { type: "Box", props: { fill: "none", border: true, radius: 0 } },
  o: { type: "Ellipse", props: {} },
  l: { type: "Line", props: { orientation: "horizontal", stroke: "#333333", dashed: false } },
  t: { type: "Text", props: { text: "Text" } },
  f: { type: "Shape", props: { shape: "rectangle", text: "Process", fill: "#ffffff", stroke: "#333333" } },
  d: { type: "DynamicPanel", props: { states: ["State 1", "State 2"], active: "State 1" } },
  h: { type: "HotSpot", props: { note: "" } },
  m: { type: "Marker", props: { shape: "circle", text: "1", color: "red" } },
};

let nextGroup = 0;

export function newGroupId(): string {
  return `grp_${Date.now().toString(36)}_${(++nextGroup).toString(36)}`;
}

export function elementRect(el: WireframeElement): CanvasRect {
  return { left: el.x, top: el.y, right: el.x + el.w, bottom: el.y + el.h };
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): CanvasRect {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}

export function rectWidth(rect: CanvasRect): number {
  return rect.right - rect.left;
}

export function rectHeight(rect: CanvasRect): number {
  return rect.bottom - rect.top;
}

function rectsIntersect(a: CanvasRect, b: CanvasRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function rectContains(outer: CanvasRect, inner: CanvasRect): boolean {
  return outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom;
}

export function marqueeHitTest(
  elements: readonly WireframeElement[],
  marquee: CanvasRect,
  mode: "intersect" | "contain",
): string[] {
  const hits: string[] = [];
  for (const el of elements) {
    if (el.hidden) continue;
    const box = elementRect(el);
    const ok = mode === "contain" ? rectContains(marquee, box) : rectsIntersect(marquee, box);
    if (ok) hits.push(el.id);
  }
  return hits;
}

export function clickSelection(selected: readonly string[], id: string, metaKey: boolean, shiftKey: boolean): string[] {
  const set = new Set(selected);
  if (metaKey || shiftKey) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
    return [...set];
  }
  return set.has(id) ? [...set] : [id];
}

export function expandToGroups(elements: readonly WireframeElement[], ids: readonly string[]): string[] {
  const groups = new Set<string>();
  for (const id of ids) {
    const el = elements.find((item) => item.id === id);
    if (el?.groupId) groups.add(el.groupId);
  }
  if (!groups.size) return [...ids];
  const out = new Set(ids);
  for (const el of elements) {
    if (el.groupId && groups.has(el.groupId)) out.add(el.id);
  }
  return [...out];
}

export function groupIds(elements: readonly WireframeElement[], ids: readonly string[]): WireframeElement[] {
  if (ids.length < 2) return [...elements];
  const groupId = newGroupId();
  const pick = new Set(ids);
  return elements.map((el) => (pick.has(el.id) ? { ...el, groupId } : el));
}

export function ungroupIds(elements: readonly WireframeElement[], ids: readonly string[]): WireframeElement[] {
  const groups = new Set<string>();
  for (const id of ids) {
    const el = elements.find((item) => item.id === id);
    if (el?.groupId) groups.add(el.groupId);
  }
  if (!groups.size) {
    const pick = new Set(ids);
    return elements.map((el) => (pick.has(el.id) ? { ...el, groupId: undefined } : el));
  }
  return elements.map((el) => (el.groupId && groups.has(el.groupId) ? { ...el, groupId: undefined } : el));
}

type Edge = { kind: "start" | "mid" | "end"; value: number };

function edges(rect: CanvasRect, axis: "x" | "y"): Edge[] {
  if (axis === "x") {
    const mid = (rect.left + rect.right) / 2;
    return [{ kind: "start", value: rect.left }, { kind: "mid", value: mid }, { kind: "end", value: rect.right }];
  }
  const mid = (rect.top + rect.bottom) / 2;
  return [{ kind: "start", value: rect.top }, { kind: "mid", value: mid }, { kind: "end", value: rect.bottom }];
}

export function snapRectToPeers(
  rect: CanvasRect,
  peers: readonly WireframeElement[],
  excludeIds: ReadonlySet<string>,
  threshold = SNAP_GUIDE_THRESHOLD,
): { dx: number; dy: number; guides: SnapGuide[] } {
  const guides: SnapGuide[] = [];
  let dx = 0;
  let dy = 0;
  let bestX = threshold + 1;
  let bestY = threshold + 1;

  const movingX = edges(rect, "x");
  const movingY = edges(rect, "y");

  for (const peer of peers) {
    if (excludeIds.has(peer.id) || peer.hidden) continue;
    const box = elementRect(peer);
    const peerX = edges(box, "x");
    const peerY = edges(box, "y");

    for (const a of movingX) {
      for (const b of peerX) {
        const delta = b.value - a.value;
        const dist = Math.abs(delta);
        if (dist > threshold || dist >= bestX) continue;
        bestX = dist;
        dx = delta;
        guides.push({
          axis: "x",
          at: b.value,
          from: Math.min(rect.top, box.top),
          to: Math.max(rect.bottom, box.bottom),
        });
      }
    }
    for (const a of movingY) {
      for (const b of peerY) {
        const delta = b.value - a.value;
        const dist = Math.abs(delta);
        if (dist > threshold || dist >= bestY) continue;
        bestY = dist;
        dy = delta;
        guides.push({
          axis: "y",
          at: b.value,
          from: Math.min(rect.left, box.left),
          to: Math.max(rect.right, box.right),
        });
      }
    }
  }

  const filtered = guides.filter((g) => (g.axis === "x" ? Math.abs(dx) <= threshold : Math.abs(dy) <= threshold));
  return { dx, dy, guides: filtered };
}

export function snapDelta(dx: number, dy: number, grid: number | null): { dx: number; dy: number } {
  if (grid === null || grid <= 0) return { dx, dy };
  return { dx: snap(dx, grid), dy: snap(dy, grid) };
}

export function nudgeStep(shiftKey: boolean): number {
  return shiftKey ? NUDGE_COARSE : NUDGE_FINE;
}

export function arrowNudge(key: string, step: number): { dx: number; dy: number } {
  if (key === "ArrowLeft") return { dx: -step, dy: 0 };
  if (key === "ArrowRight") return { dx: step, dy: 0 };
  if (key === "ArrowUp") return { dx: 0, dy: -step };
  if (key === "ArrowDown") return { dx: 0, dy: step };
  return { dx: 0, dy: 0 };
}

export function resizeByArrow(el: WireframeElement, key: string, step: number): WireframeElement {
  const min = SNAP;
  if (key === "ArrowLeft") return { ...el, w: Math.max(min, el.w - step) };
  if (key === "ArrowRight") return { ...el, w: Math.max(min, el.w + step) };
  if (key === "ArrowUp") return { ...el, h: Math.max(min, el.h - step) };
  if (key === "ArrowDown") return { ...el, h: Math.max(min, el.h + step) };
  return el;
}

export function moveElementsByDelta(
  elements: readonly WireframeElement[],
  ids: ReadonlySet<string>,
  dx: number,
  dy: number,
  orig: Record<string, { x: number; y: number }>,
): WireframeElement[] {
  return elements.map((el) => {
    const from = orig[el.id];
    if (!from) return el;
    return { ...el, x: from.x + dx, y: from.y + dy };
  });
}

export function distanceLinesFor(
  target: WireframeElement,
  others: readonly WireframeElement[],
  maxGap = 240,
): DistanceLine[] {
  const box = elementRect(target);
  const lines: DistanceLine[] = [];
  for (const peer of others) {
    if (peer.id === target.id || peer.hidden) continue;
    const other = elementRect(peer);
    const gapRight = other.left - box.right;
    if (gapRight > 0 && gapRight <= maxGap) {
      const from = Math.max(box.top, other.top);
      const to = Math.min(box.bottom, other.bottom);
      if (to > from) lines.push({ axis: "x", from, to, at: (box.right + other.left) / 2, gap: gapRight });
    }
    const gapLeft = box.left - other.right;
    if (gapLeft > 0 && gapLeft <= maxGap) {
      const from = Math.max(box.top, other.top);
      const to = Math.min(box.bottom, other.bottom);
      if (to > from) lines.push({ axis: "x", from, to, at: (other.right + box.left) / 2, gap: gapLeft });
    }
    const gapBelow = other.top - box.bottom;
    if (gapBelow > 0 && gapBelow <= maxGap) {
      const from = Math.max(box.left, other.left);
      const to = Math.min(box.right, other.right);
      if (to > from) lines.push({ axis: "y", from, to, at: (box.bottom + other.top) / 2, gap: gapBelow });
    }
    const gapAbove = box.top - other.bottom;
    if (gapAbove > 0 && gapAbove <= maxGap) {
      const from = Math.max(box.left, other.left);
      const to = Math.min(box.right, other.right);
      if (to > from) lines.push({ axis: "y", from, to, at: (other.bottom + box.top) / 2, gap: gapAbove });
    }
  }
  return lines;
}

export function zoomIn(level: number): number {
  return Math.min(4, Math.round((level + 0.1) * 100) / 100);
}

export function zoomOut(level: number): number {
  return Math.max(0.1, Math.round((level - 0.1) * 100) / 100);
}

export function zoomToFit(
  canvasW: number,
  canvasH: number,
  paneW: number,
  paneH: number,
  padding = 32,
): number {
  const next = Math.min((paneW - padding) / canvasW, (paneH - padding) / canvasH);
  return Math.max(0.1, Math.min(4, Math.round(next * 100) / 100));
}

export function zoomToBounds(
  bounds: CanvasRect,
  paneW: number,
  paneH: number,
  padding = 48,
): number {
  const w = rectWidth(bounds);
  const h = rectHeight(bounds);
  if (w <= 0 || h <= 0) return 1;
  const next = Math.min((paneW - padding) / w, (paneH - padding) / h);
  return Math.max(0.1, Math.min(4, Math.round(next * 100) / 100));
}

export function selectionRect(elements: readonly WireframeElement[], ids: readonly string[]): CanvasRect | null {
  const picked = elements.filter((el) => ids.includes(el.id));
  if (!picked.length) return null;
  const left = Math.min(...picked.map((el) => el.x));
  const top = Math.min(...picked.map((el) => el.y));
  const right = Math.max(...picked.map((el) => el.x + el.w));
  const bottom = Math.max(...picked.map((el) => el.y + el.h));
  return { left, top, right, bottom };
}

export function gridStep(useFineGrid: boolean): number {
  return useFineGrid ? FINE_GRID : SNAP;
}

export function elementAtPoint(elements: readonly WireframeElement[], x: number, y: number): WireframeElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (el.hidden) continue;
    if (x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h) return el;
  }
  return null;
}
