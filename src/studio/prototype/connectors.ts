// Connector geometry: anchors, routing, bounds, sync when shapes move.
import { SNAP, snap, type PropValue, type WireframeElement } from "./model.ts";

export type ConnectorAnchor = "top" | "right" | "bottom" | "left" | "auto";
export type ConnectorRouting = "straight" | "elbow" | "curved";
export type ConnectorArrowHead = "none" | "arrow" | "dot";

export type Point = { x: number; y: number };

export type ConnectorProps = {
  fromId: string;
  fromAnchor: ConnectorAnchor;
  toId: string;
  toAnchor: ConnectorAnchor;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  bendX: number;
  bendY: number;
  routing: ConnectorRouting;
  startArrow: ConnectorArrowHead;
  endArrow: ConnectorArrowHead;
  dashed: boolean;
  label: string;
};

export const CONNECTOR_TOOL: { type: "Connector" } = { type: "Connector" };

const ANCHORS: ConnectorAnchor[] = ["top", "right", "bottom", "left"];

function str(p: Record<string, PropValue>, key: string, fallback = ""): string {
  const v = p[key];
  return typeof v === "string" ? v : fallback;
}

function num(p: Record<string, PropValue>, key: string, fallback = 0): number {
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(p: Record<string, PropValue>, key: string, fallback = false): boolean {
  const v = p[key];
  return typeof v === "boolean" ? v : fallback;
}

export function isConnector(el: WireframeElement): boolean {
  return el.type === "Connector";
}

export function readConnectorProps(el: WireframeElement): ConnectorProps {
  const p = el.props;
  const routing = str(p, "routing", "elbow");
  const startArrow = str(p, "startArrow", "none");
  const endArrow = str(p, "endArrow", "arrow");
  return {
    fromId: str(p, "fromId"),
    fromAnchor: parseAnchor(str(p, "fromAnchor", "auto")),
    toId: str(p, "toId"),
    toAnchor: parseAnchor(str(p, "toAnchor", "auto")),
    startX: num(p, "startX"),
    startY: num(p, "startY"),
    endX: num(p, "endX"),
    endY: num(p, "endY"),
    bendX: num(p, "bendX"),
    bendY: num(p, "bendY"),
    routing: routing === "straight" || routing === "curved" ? routing : "elbow",
    startArrow: startArrow === "arrow" || startArrow === "dot" ? startArrow : "none",
    endArrow: endArrow === "none" || endArrow === "dot" ? endArrow : "arrow",
    dashed: bool(p, "dashed"),
    label: str(p, "label"),
  };
}

export function connectorPropsToRecord(props: Partial<ConnectorProps>): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  if (props.fromId !== undefined) out.fromId = props.fromId;
  if (props.fromAnchor !== undefined) out.fromAnchor = props.fromAnchor;
  if (props.toId !== undefined) out.toId = props.toId;
  if (props.toAnchor !== undefined) out.toAnchor = props.toAnchor;
  if (props.startX !== undefined) out.startX = props.startX;
  if (props.startY !== undefined) out.startY = props.startY;
  if (props.endX !== undefined) out.endX = props.endX;
  if (props.endY !== undefined) out.endY = props.endY;
  if (props.bendX !== undefined) out.bendX = props.bendX;
  if (props.bendY !== undefined) out.bendY = props.bendY;
  if (props.routing !== undefined) out.routing = props.routing;
  if (props.startArrow !== undefined) out.startArrow = props.startArrow;
  if (props.endArrow !== undefined) out.endArrow = props.endArrow;
  if (props.dashed !== undefined) out.dashed = props.dashed;
  if (props.label !== undefined) out.label = props.label;
  return out;
}

function parseAnchor(value: string): ConnectorAnchor {
  return ANCHORS.includes(value as ConnectorAnchor) ? (value as ConnectorAnchor) : "auto";
}

export function anchorPoint(el: WireframeElement, anchor: ConnectorAnchor): Point {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  switch (anchor) {
    case "top":
      return { x: cx, y: el.y };
    case "right":
      return { x: el.x + el.w, y: cy };
    case "bottom":
      return { x: cx, y: el.y + el.h };
    case "left":
      return { x: el.x, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

export function pickAnchor(from: WireframeElement, to: WireframeElement, side: "from" | "to"): ConnectorAnchor {
  const a = side === "from" ? anchorPoint(from, "auto") : anchorPoint(to, "auto");
  const b = side === "from" ? anchorPoint(to, "auto") : anchorPoint(from, "auto");
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function elementById(elements: readonly WireframeElement[], id: string): WireframeElement | null {
  if (!id) return null;
  return elements.find((el) => el.id === id) ?? null;
}

export function resolveEndpoint(
  props: ConnectorProps,
  elements: readonly WireframeElement[],
  end: "start" | "end",
): Point {
  if (end === "start") {
    const from = elementById(elements, props.fromId);
    if (from) return anchorPoint(from, props.fromAnchor === "auto" ? pickAnchor(from, elementById(elements, props.toId) ?? from, "from") : props.fromAnchor);
    return { x: props.startX, y: props.startY };
  }
  const to = elementById(elements, props.toId);
  if (to) {
    const from = elementById(elements, props.fromId);
    const anchor =
      props.toAnchor === "auto" && from
        ? pickAnchor(to, from, "to")
        : props.toAnchor === "auto"
          ? "top"
          : props.toAnchor;
    return anchorPoint(to, anchor);
  }
  return { x: props.endX, y: props.endY };
}

function exitVector(anchor: ConnectorAnchor): Point {
  switch (anchor) {
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

export function effectiveAnchor(
  props: ConnectorProps,
  elements: readonly WireframeElement[],
  end: "start" | "end",
): ConnectorAnchor {
  if (end === "start") {
    if (!props.fromId) return "auto";
    const from = elementById(elements, props.fromId);
    if (!from) return props.fromAnchor;
    if (props.fromAnchor !== "auto") return props.fromAnchor;
    const to = elementById(elements, props.toId);
    return to ? pickAnchor(from, to, "from") : "right";
  }
  if (!props.toId) return "auto";
  const to = elementById(elements, props.toId);
  if (!to) return props.toAnchor;
  if (props.toAnchor !== "auto") return props.toAnchor;
  const from = elementById(elements, props.fromId);
  return from ? pickAnchor(to, from, "to") : "left";
}

export function routePoints(
  start: Point,
  end: Point,
  routing: ConnectorRouting,
  startAnchor: ConnectorAnchor,
  endAnchor: ConnectorAnchor,
  bend?: Point | null,
): Point[] {
  if (routing === "straight") return [start, end];
  if (routing === "curved") {
    const mid = bend ?? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return [start, mid, end];
  }
  const pad = 16;
  const sv = exitVector(startAnchor);
  const ev = exitVector(endAnchor);
  const s1 = { x: start.x + sv.x * pad, y: start.y + sv.y * pad };
  const e1 = { x: end.x + ev.x * pad, y: end.y + ev.y * pad };
  if (bend && (bend.x !== 0 || bend.y !== 0)) {
    return [start, s1, bend, e1, end];
  }
  if (Math.abs(sv.x) > 0) {
    const corner = { x: e1.x, y: s1.y };
    return [start, s1, corner, e1, end];
  }
  if (Math.abs(sv.y) > 0) {
    const corner = { x: s1.x, y: e1.y };
    return [start, s1, corner, e1, end];
  }
  const corner = { x: (s1.x + e1.x) / 2, y: (s1.y + e1.y) / 2 };
  return [start, s1, corner, e1, end];
}

export function connectorPathPoints(el: WireframeElement, elements: readonly WireframeElement[]): Point[] {
  const props = readConnectorProps(el);
  const start = resolveEndpoint(props, elements, "start");
  const end = resolveEndpoint(props, elements, "end");
  const startAnchor = effectiveAnchor(props, elements, "start");
  const endAnchor = effectiveAnchor(props, elements, "end");
  const bend =
    props.bendX !== 0 || props.bendY !== 0 ? { x: props.bendX, y: props.bendY } : props.routing === "curved" ? null : null;
  return routePoints(start, end, props.routing, startAnchor, endAnchor, bend);
}

export function boundsFromPoints(points: readonly Point[], padding = 8): { x: number; y: number; w: number; h: number } {
  if (!points.length) return { x: 0, y: 0, w: SNAP, h: SNAP };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs) - padding;
  const top = Math.min(...ys) - padding;
  const right = Math.max(...xs) + padding;
  const bottom = Math.max(...ys) + padding;
  const w = Math.max(SNAP, snap(right - left));
  const h = Math.max(SNAP, snap(bottom - top));
  return { x: snap(left), y: snap(top), w, h };
}

export function labelPosition(points: readonly Point[]): Point {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const mid = Math.floor(points.length / 2);
  const a = points[mid - 1] ?? points[0]!;
  const b = points[mid] ?? points[points.length - 1]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function pathToSvgD(points: readonly Point[], routing: ConnectorRouting): string {
  if (!points.length) return "";
  const [first, ...rest] = points;
  if (routing === "curved" && points.length === 3) {
    return `M ${first!.x} ${first!.y} Q ${rest[0]!.x} ${rest[0]!.y} ${rest[1]!.x} ${rest[1]!.y}`;
  }
  return `M ${first!.x} ${first!.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}

export function distanceToPolyline(x: number, y: number, points: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    best = Math.min(best, distanceToSegment(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function hitConnector(el: WireframeElement, elements: readonly WireframeElement[], x: number, y: number, threshold = 8): boolean {
  if (!isConnector(el)) return false;
  const points = connectorPathPoints(el, elements);
  return distanceToPolyline(x, y, points) <= threshold;
}

export function refreshConnector(el: WireframeElement, elements: readonly WireframeElement[]): WireframeElement {
  if (!isConnector(el)) return el;
  const props = readConnectorProps(el);
  const points = connectorPathPoints(el, elements);
  const bounds = boundsFromPoints(points);
  const start = resolveEndpoint(props, elements, "start");
  const end = resolveEndpoint(props, elements, "end");
  const patch: Partial<ConnectorProps> = {};
  if (!props.fromId) {
    patch.startX = start.x;
    patch.startY = start.y;
  }
  if (!props.toId) {
    patch.endX = end.x;
    patch.endY = end.y;
  }
  return {
    ...el,
    ...bounds,
    props: { ...el.props, ...connectorPropsToRecord(patch) },
  };
}

export function refreshConnectorsForElements(elements: WireframeElement[], movedIds: ReadonlySet<string>): WireframeElement[] {
  const touch = (el: WireframeElement) => {
    if (!isConnector(el)) return el;
    const props = readConnectorProps(el);
    if ((props.fromId && movedIds.has(props.fromId)) || (props.toId && movedIds.has(props.toId))) {
      return refreshConnector(el, elements);
    }
    return el;
  };
  const first = elements.map(touch);
  return first.map((el) => (isConnector(el) ? refreshConnector(el, first) : el));
}

export function refreshAllConnectors(elements: WireframeElement[]): WireframeElement[] {
  const pass = elements.map((el) => (isConnector(el) ? refreshConnector(el, elements) : el));
  return pass.map((el) => (isConnector(el) ? refreshConnector(el, pass) : el));
}

export function detachConnectorsOnDelete(elements: WireframeElement[], deletedIds: ReadonlySet<string>): WireframeElement[] {
  return elements.map((el) => {
    if (!isConnector(el)) return el;
    const props = readConnectorProps(el);
    let next = { ...el };
    const patch: Partial<ConnectorProps> = {};
    if (props.fromId && deletedIds.has(props.fromId)) {
      const start = resolveEndpoint(props, elements, "start");
      patch.fromId = "";
      patch.fromAnchor = "auto";
      patch.startX = start.x;
      patch.startY = start.y;
    }
    if (props.toId && deletedIds.has(props.toId)) {
      const end = resolveEndpoint(props, elements, "end");
      patch.toId = "";
      patch.toAnchor = "auto";
      patch.endX = end.x;
      patch.endY = end.y;
    }
    if (Object.keys(patch).length) {
      next = { ...next, props: { ...next.props, ...connectorPropsToRecord(patch) } };
    }
    return refreshConnector(next, elements.filter((item) => !deletedIds.has(item.id)));
  });
}

export function defaultConnectorProps(): Record<string, PropValue> {
  return connectorPropsToRecord({
    fromId: "",
    fromAnchor: "auto",
    toId: "",
    toAnchor: "auto",
    startX: 0,
    startY: 0,
    endX: 80,
    endY: 0,
    bendX: 0,
    bendY: 0,
    routing: "elbow",
    startArrow: "none",
    endArrow: "arrow",
    dashed: false,
    label: "",
  });
}

export function createConnectorElement(
  id: string,
  label: string,
  existing: readonly WireframeElement[],
  start: { elementId?: string; anchor?: ConnectorAnchor; x: number; y: number },
  end: { elementId?: string; anchor?: ConnectorAnchor; x: number; y: number },
): WireframeElement {
  const fromEl = start.elementId ? elementById(existing, start.elementId) : null;
  const toEl = end.elementId ? elementById(existing, end.elementId) : null;
  const props: ConnectorProps = {
    fromId: start.elementId ?? "",
    fromAnchor: start.anchor ?? (fromEl && toEl ? pickAnchor(fromEl, toEl, "from") : "auto"),
    toId: end.elementId ?? "",
    toAnchor: end.anchor ?? (fromEl && toEl ? pickAnchor(toEl, fromEl, "to") : "auto"),
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    bendX: 0,
    bendY: 0,
    routing: "elbow",
    startArrow: "none",
    endArrow: "arrow",
    dashed: false,
    label: "",
  };
  let el: WireframeElement = {
    id,
    type: "Connector",
    label,
    x: 0,
    y: 0,
    w: SNAP,
    h: SNAP,
    props: connectorPropsToRecord(props),
  };
  el = refreshConnector(el, existing);
  return el;
}

export function anchorAtPoint(el: WireframeElement, x: number, y: number, threshold = 12): ConnectorAnchor | null {
  let best: ConnectorAnchor | null = null;
  let bestDist = threshold;
  for (const anchor of ANCHORS) {
    const p = anchorPoint(el, anchor);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestDist) {
      bestDist = d;
      best = anchor;
    }
  }
  return best;
}

export function shapeElements(elements: readonly WireframeElement[]): WireframeElement[] {
  return elements.filter((el) => !isConnector(el) && !el.hidden);
}

export function connectorStroke(el: WireframeElement): { color: string; width: number } {
  const stroke = el.style?.base?.stroke;
  const width = el.style?.base?.strokeWidth;
  return {
    color: typeof stroke === "string" && stroke ? stroke : "#333333",
    width: typeof width === "number" && width > 0 ? width : 2,
  };
}
