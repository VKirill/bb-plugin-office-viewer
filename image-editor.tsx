// Office Viewer — image editor: boxes, ellipses, arrows, lines, pen, marker,
// text, numbered steps and blur over a picture, plus crop, rotate and flip.
// Annotations stay editable SVG until export; crop, rotate and flip bake them
// into the bitmap first. Saves PNG/JPEG/WebP as a copy, over the original,
// to the clipboard, as a download or into the chat.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowUpRight01Icon,
  BlurIcon,
  CircleIcon,
  Copy01Icon,
  CropIcon,
  Cursor01Icon,
  Download01Icon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  HighlighterIcon,
  MinusSignIcon,
  Pen01Icon,
  Redo02Icon,
  RotateLeftIcon,
  RotateRightIcon,
  SentIcon,
  SquareIcon,
  TextIcon,
  Undo02Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@hugeicons/core-free-icons";
import { useComposer } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { t } from "./i18n";

type Tool = "select" | "rect" | "ellipse" | "arrow" | "line" | "pen" | "marker" | "text" | "step" | "blur" | "crop";
type Box = { x: number; y: number; w: number; h: number };
type Common = { id: string; color: string; /** Stroke width in image pixels. */ size: number };
type Shape = Common &
  (
    | ({ type: "rect" | "ellipse" | "blur"; fill: boolean } & Box)
    | { type: "arrow" | "line"; x1: number; y1: number; x2: number; y2: number }
    | { type: "pen" | "marker"; points: number[] }
    | { type: "text"; x: number; y: number; text: string; fill: boolean }
    | { type: "step"; x: number; y: number; n: number }
  );
/** One undo step; `rev` tells saved states apart after the history is trimmed. */
type Doc = { image: HTMLCanvasElement; shapes: Shape[]; rev: number };
type Drag =
  | { kind: "draw"; shape: Shape; x0: number; y0: number }
  | { kind: "move"; id: string; x0: number; y0: number; orig: Shape; moved: boolean }
  | { kind: "handle"; id: string; handle: string; orig: Shape }
  | { kind: "crop"; x0: number; y0: number };

export type ImageFormat = "png" | "jpeg" | "webp";
export type WriteImage = (name: string, blob: Blob, overwrite: boolean) => Promise<{ name: string; absPath: string }>;

const COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#111827", "#ffffff"];
const SIZES = [1, 2, 3.5];
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MAX_HISTORY = 60;
const MIME: Record<ImageFormat, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const EXT: Record<ImageFormat, string> = { png: "png", jpeg: "jpg", webp: "webp" };

const TOOLS: { tool: Tool; key: string; icon: IconSvgElement | null; label: string }[] = [
  { tool: "select", key: "v", icon: Cursor01Icon, label: "toolSelect" },
  { tool: "rect", key: "r", icon: SquareIcon, label: "toolRect" },
  { tool: "ellipse", key: "o", icon: CircleIcon, label: "toolEllipse" },
  { tool: "arrow", key: "a", icon: ArrowUpRight01Icon, label: "toolArrow" },
  { tool: "line", key: "l", icon: MinusSignIcon, label: "toolLine" },
  { tool: "pen", key: "p", icon: Pen01Icon, label: "toolPen" },
  { tool: "marker", key: "m", icon: HighlighterIcon, label: "toolMarker" },
  { tool: "text", key: "t", icon: TextIcon, label: "toolText" },
  { tool: "step", key: "n", icon: null, label: "toolStep" },
  { tool: "blur", key: "b", icon: BlurIcon, label: "toolBlur" },
  { tool: "crop", key: "c", icon: CropIcon, label: "toolCrop" },
];

let nextId = 0;
const newId = () => `s${++nextId}`;
let nextRev = 0;

/** Decodes an image file into a canvas; SVGs are rasterised at their own size. */
export async function canvasFromBlob(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1024;
    canvas.height = image.naturalHeight || 768;
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasBlob(canvas: HTMLCanvasElement, format: ImageFormat = "png", quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))), MIME[format], quality),
  );
}

function contrast(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

const fontSize = (s: Common) => Math.max(12, s.size * 5);
const stepRadius = (s: Common) => s.size * 2.6 + 6;
const textPad = (s: Common) => fontSize(s) * 0.35;

let measurer: CanvasRenderingContext2D | null = null;
function textBox(s: Extract<Shape, { type: "text" }>): Box {
  measurer ??= document.createElement("canvas").getContext("2d");
  const fs = fontSize(s);
  measurer!.font = `600 ${fs}px ${FONT}`;
  const lines = s.text.split("\n");
  const width = Math.max(fs, ...lines.map((line) => measurer!.measureText(line).width));
  const pad = textPad(s);
  return { x: s.x, y: s.y, w: width + pad * 2, h: lines.length * fs * 1.25 + pad * 2 };
}

function bounds(s: Shape): Box {
  switch (s.type) {
    case "rect":
    case "ellipse":
    case "blur":
      return { x: s.x, y: s.y, w: s.w, h: s.h };
    case "arrow":
    case "line":
      return { x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2), w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1) };
    case "pen":
    case "marker": {
      const xs = s.points.filter((_, i) => i % 2 === 0);
      const ys = s.points.filter((_, i) => i % 2 === 1);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case "text":
      return textBox(s);
    case "step": {
      const r = stepRadius(s);
      return { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 };
    }
  }
}

function translate(s: Shape, dx: number, dy: number): Shape {
  switch (s.type) {
    case "arrow":
    case "line":
      return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
    case "pen":
    case "marker":
      return { ...s, points: s.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
    default:
      return { ...s, x: s.x + dx, y: s.y + dy };
  }
}

function normalize(x0: number, y0: number, x1: number, y1: number, square: boolean): Box {
  let w = x1 - x0, h = y1 - y0;
  if (square) {
    const side = Math.max(Math.abs(w), Math.abs(h));
    w = Math.sign(w || 1) * side;
    h = Math.sign(h || 1) * side;
  }
  return { x: Math.min(x0, x0 + w), y: Math.min(y0, y0 + h), w: Math.abs(w), h: Math.abs(h) };
}

/** Snaps a segment to 45° steps while Shift is held. */
function snap(x0: number, y0: number, x1: number, y1: number) {
  const angle = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4);
  const length = Math.hypot(x1 - x0, y1 - y0);
  return { x: x0 + Math.cos(angle) * length, y: y0 + Math.sin(angle) * length };
}

function ShapeView({ s, hitWidth }: { s: Shape; hitWidth: number }) {
  const hit = (d: ReactNode) => <g data-id={s.id}>{d}</g>;
  switch (s.type) {
    case "rect":
      return hit(<rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.size} fill={s.fill ? s.color : "transparent"} fillOpacity={s.fill ? 0.3 : 1} stroke={s.color} strokeWidth={s.size} />);
    case "ellipse":
      return hit(<ellipse cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} fill={s.fill ? s.color : "transparent"} fillOpacity={s.fill ? 0.3 : 1} stroke={s.color} strokeWidth={s.size} />);
    case "blur":
      return hit(<rect x={s.x} y={s.y} width={s.w} height={s.h} fill="transparent" />);
    case "line":
      return hit(
        <>
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={s.size} strokeLinecap="round" />
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth={hitWidth} />
        </>,
      );
    case "arrow": {
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const head = Math.min(Math.max(s.size * 4.5, 12), Math.hypot(s.x2 - s.x1, s.y2 - s.y1));
      const spread = Math.PI / 7;
      const bx = s.x2 - Math.cos(angle) * head * 0.8, by = s.y2 - Math.sin(angle) * head * 0.8;
      const p = (a: number) => `${s.x2 - Math.cos(a) * head},${s.y2 - Math.sin(a) * head}`;
      return hit(
        <>
          <line x1={s.x1} y1={s.y1} x2={bx} y2={by} stroke={s.color} strokeWidth={s.size} strokeLinecap="round" />
          <polygon points={`${s.x2},${s.y2} ${p(angle - spread)} ${p(angle + spread)}`} fill={s.color} stroke={s.color} strokeWidth={s.size * 0.5} strokeLinejoin="round" />
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth={hitWidth} />
        </>,
      );
    }
    case "pen":
    case "marker": {
      const width = s.type === "marker" ? s.size * 5 : s.size;
      const points = s.points.join(" ");
      return hit(
        <>
          <polyline points={points} fill="none" stroke={s.color} strokeOpacity={s.type === "marker" ? 0.4 : 1} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(width, hitWidth)} />
        </>,
      );
    }
    case "text": {
      const fs = fontSize(s);
      const pad = textPad(s);
      const box = textBox(s);
      const ink = s.fill ? contrast(s.color) : s.color;
      return hit(
        <>
          {s.fill ? <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={pad} fill={s.color} /> : <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="transparent" />}
          <text
            x={s.x + pad}
            fontFamily={FONT}
            fontWeight={600}
            fontSize={fs}
            fill={ink}
            stroke={s.fill ? "none" : contrast(s.color)}
            strokeWidth={fs * 0.14}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {s.text.split("\n").map((line, i) => (
              <tspan key={i} x={s.x + pad} y={s.y + pad + fs * (0.95 + i * 1.25)}>{line || " "}</tspan>
            ))}
          </text>
        </>,
      );
    }
    case "step": {
      const r = stepRadius(s);
      return hit(
        <>
          <circle cx={s.x} cy={s.y} r={r} fill={s.color} stroke="#ffffff" strokeWidth={r * 0.12} />
          <text x={s.x} y={s.y} dy="0.36em" textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={r * 1.15} fill={contrast(s.color)}>{s.n}</text>
        </>,
      );
    }
  }
}

/** Draws the bitmap with every blur region pixelated. */
function paintBase(target: HTMLCanvasElement, image: HTMLCanvasElement, shapes: Shape[]) {
  target.width = image.width;
  target.height = image.height;
  const ctx = target.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const block = Math.max(6, Math.round(Math.max(image.width, image.height) / 90));
  for (const s of shapes) {
    if (s.type !== "blur" || s.w < 1 || s.h < 1) continue;
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.ceil(s.w / block));
    small.height = Math.max(1, Math.ceil(s.h / block));
    small.getContext("2d")!.drawImage(image, s.x, s.y, s.w, s.h, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, small.width, small.height, s.x, s.y, s.w, s.h);
    ctx.imageSmoothingEnabled = true;
  }
}

/** The bitmap with blurs and every vector annotation baked in, at full size. */
async function flatten(doc: Doc, svg: SVGSVGElement | null): Promise<HTMLCanvasElement> {
  const out = document.createElement("canvas");
  paintBase(out, doc.image, doc.shapes);
  if (!svg || !doc.shapes.some((s) => s.type !== "blur")) return out;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-overlay]").forEach((node) => node.remove());
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(out.width));
  clone.setAttribute("height", String(out.height));
  clone.removeAttribute("style");
  clone.removeAttribute("class");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const layer = new Image();
    layer.src = url;
    await layer.decode();
    out.getContext("2d")!.drawImage(layer, 0, 0, out.width, out.height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return out;
}

function transformed(source: HTMLCanvasElement, op: "left" | "right" | "flipX" | "flipY" | Box): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const ctx = () => out.getContext("2d")!;
  if (op === "left" || op === "right") {
    out.width = source.height;
    out.height = source.width;
    const c = ctx();
    c.translate(out.width / 2, out.height / 2);
    c.rotate(op === "right" ? Math.PI / 2 : -Math.PI / 2);
    c.drawImage(source, -source.width / 2, -source.height / 2);
  } else if (op === "flipX" || op === "flipY") {
    out.width = source.width;
    out.height = source.height;
    const c = ctx();
    if (op === "flipX") c.setTransform(-1, 0, 0, 1, out.width, 0);
    else c.setTransform(1, 0, 0, -1, 0, out.height);
    c.drawImage(source, 0, 0);
  } else {
    out.width = Math.max(1, Math.round(op.w));
    out.height = Math.max(1, Math.round(op.h));
    ctx().drawImage(source, Math.round(op.x), Math.round(op.y), out.width, out.height, 0, 0, out.width, out.height);
  }
  return out;
}

function scaled(source: HTMLCanvasElement, factor: number, opaque: boolean): HTMLCanvasElement {
  if (factor === 1 && !opaque) return source;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(source.width * factor));
  out.height = Math.max(1, Math.round(source.height * factor));
  const c = out.getContext("2d")!;
  if (opaque) {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, out.width, out.height);
  }
  c.imageSmoothingQuality = "high";
  c.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function ToolIcon({ icon }: { icon: IconSvgElement }) {
  return <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />;
}

function Tb({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <span title={label} className="shrink-0">
      <Button variant="ghost" size="icon" className="size-8" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </span>
  );
}

export function ImageEditor({
  image,
  name,
  overwriteFormat,
  write,
  onClose,
  onSaved,
}: {
  image: HTMLCanvasElement;
  /** Original file name; copies are named after it. */
  name: string;
  /** Format the original can be overwritten in; null when only copies are allowed. */
  overwriteFormat: ImageFormat | null;
  write: WriteImage | null;
  onClose: () => void;
  onSaved: (result: { name: string; absPath: string }, overwrite: boolean) => void;
}) {
  const composer = useComposer();
  const [{ history, index }, setTimeline] = useState(() => ({ history: [{ image, shapes: [] as Shape[], rev: ++nextRev }], index: 0 }));
  const doc = history[index]!;
  const [live, setLive] = useState<Shape[] | null>(null);
  const shapes = live ?? doc.shapes;
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0]!);
  const [sizeStep, setSizeStep] = useState(1);
  const [fill, setFill] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [crop, setCrop] = useState<Box | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [fit, setFit] = useState(1);
  const [busy, setBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedRev, setSavedRev] = useState(() => history[0]!.rev);
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  // Escape commits, then the unmounting field blurs: only the first finish counts.
  const finishing = useRef<string | null>(null);
  const startEditing = (id: string) => { finishing.current = null; setEditing(id); };
  const W = doc.image.width, H = doc.image.height;
  const scale = zoom ?? fit;
  const unit = Math.max(2, Math.round(Math.max(W, H) / 400));
  const strokeSize = unit * SIZES[sizeStep]!;
  const dirty = doc.rev !== savedRev;

  useEffect(() => rootRef.current?.focus(), []);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () => setFit(Math.min(1, (area.clientWidth - 32) / W, (area.clientHeight - 32) / H));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [W, H]);

  const blurKey = useMemo(() => JSON.stringify(shapes.filter((s) => s.type === "blur")), [shapes]);
  useEffect(() => {
    if (baseRef.current) paintBase(baseRef.current, doc.image, shapes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.image, blurKey]);

  const commit = useCallback((next: Omit<Doc, "rev">) => {
    setTimeline((s) => {
      const kept = s.history.slice(Math.max(0, s.index + 1 - MAX_HISTORY), s.index + 1);
      return { history: [...kept, { ...next, rev: ++nextRev }], index: kept.length };
    });
    setLive(null);
  }, []);
  const setShapes = (next: Shape[]) => commit({ image: doc.image, shapes: next });
  const undo = () => { setEditing(null); setSelected(null); setLive(null); setTimeline((s) => ({ ...s, index: Math.max(0, s.index - 1) })); };
  const redo = () => { setEditing(null); setLive(null); setTimeline((s) => ({ ...s, index: Math.min(s.history.length - 1, s.index + 1) })); };

  const selectedShape = shapes.find((s) => s.id === selected) ?? null;
  const patchSelected = (patch: Partial<Shape>) => {
    if (!selectedShape) return;
    setShapes(shapes.map((s) => (s.id === selectedShape.id ? ({ ...s, ...patch } as Shape) : s)));
  };
  const pickColor = (next: string) => { setColor(next); patchSelected({ color: next }); };
  const pickSize = (step: number) => { setSizeStep(step); patchSelected({ size: unit * SIZES[step]! }); };
  const toggleFill = () => {
    const next = !fill;
    setFill(next);
    if (selectedShape && "fill" in selectedShape) patchSelected({ fill: next } as Partial<Shape>);
  };
  const removeSelected = () => {
    if (!selected) return;
    setShapes(shapes.filter((s) => s.id !== selected));
    setSelected(null);
  };

  const point = (event: PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: Math.min(W, Math.max(0, (event.clientX - rect.left) / scale)), y: Math.min(H, Math.max(0, (event.clientY - rect.top) / scale)) };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || busy) return;
    if (editing) { setEditing(null); return; }
    const { x, y } = point(event);
    const target = event.target as Element;
    const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
    const hitId = target.closest("[data-id]")?.getAttribute("data-id") ?? null;
    const hitShape = hitId ? shapes.find((s) => s.id === hitId) ?? null : null;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (handle && selectedShape) {
      drag.current = { kind: "handle", id: selectedShape.id, handle, orig: selectedShape };
      return;
    }
    if (tool === "crop") {
      drag.current = { kind: "crop", x0: x, y0: y };
      setCrop({ x, y, w: 0, h: 0 });
      return;
    }
    if (tool === "select") {
      setSelected(hitShape?.id ?? null);
      if (hitShape) drag.current = { kind: "move", id: hitShape.id, x0: x, y0: y, orig: hitShape, moved: false };
      return;
    }
    if (tool === "text") {
      if (hitShape?.type === "text") { setSelected(hitShape.id); startEditing(hitShape.id); return; }
      const shape: Shape = { id: newId(), type: "text", x, y, text: "", fill, color, size: strokeSize };
      setShapes([...shapes, shape]);
      setSelected(shape.id);
      startEditing(shape.id);
      return;
    }
    if (tool === "step") {
      const n = Math.max(0, ...shapes.map((s) => (s.type === "step" ? s.n : 0))) + 1;
      const shape: Shape = { id: newId(), type: "step", x, y, n, color, size: strokeSize };
      setShapes([...shapes, shape]);
      setSelected(shape.id);
      return;
    }
    const base = { id: newId(), color, size: strokeSize };
    const shape: Shape =
      tool === "arrow" || tool === "line"
        ? { ...base, type: tool, x1: x, y1: y, x2: x, y2: y }
        : tool === "pen" || tool === "marker"
          ? { ...base, type: tool, points: [x, y] }
          : { ...base, type: tool, fill: tool === "blur" ? false : fill, x, y, w: 0, h: 0 };
    drag.current = { kind: "draw", shape, x0: x, y0: y };
    setSelected(null);
    setLive([...shapes, shape]);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current) return;
    const { x, y } = point(event);
    if (current.kind === "crop") {
      setCrop(normalize(current.x0, current.y0, x, y, event.shiftKey));
      return;
    }
    if (current.kind === "move") {
      current.moved = true;
      setLive(doc.shapes.map((s) => (s.id === current.id ? translate(current.orig, x - current.x0, y - current.y0) : s)));
      return;
    }
    if (current.kind === "handle") {
      const o = current.orig;
      let next: Shape = o;
      if (o.type === "arrow" || o.type === "line") {
        const fixed = current.handle === "p1" ? { x: o.x2, y: o.y2 } : { x: o.x1, y: o.y1 };
        const p = event.shiftKey ? snap(fixed.x, fixed.y, x, y) : { x, y };
        next = current.handle === "p1" ? { ...o, x1: p.x, y1: p.y } : { ...o, x2: p.x, y2: p.y };
      } else if (o.type === "rect" || o.type === "ellipse" || o.type === "blur") {
        const fx = current.handle.includes("w") ? o.x + o.w : o.x;
        const fy = current.handle.includes("n") ? o.y + o.h : o.y;
        next = { ...o, ...normalize(fx, fy, x, y, event.shiftKey) };
      }
      setLive(doc.shapes.map((s) => (s.id === current.id ? next : s)));
      return;
    }
    const s = current.shape;
    let next: Shape;
    if (s.type === "arrow" || s.type === "line") {
      const p = event.shiftKey ? snap(current.x0, current.y0, x, y) : { x, y };
      next = { ...s, x2: p.x, y2: p.y };
    } else if (s.type === "pen" || s.type === "marker") {
      const last = s.points.length;
      if (Math.hypot(x - s.points[last - 2]!, y - s.points[last - 1]!) < 1.5 / scale) return;
      next = { ...s, points: [...s.points, x, y] };
    } else {
      next = { ...s, ...normalize(current.x0, current.y0, x, y, event.shiftKey) } as Shape;
    }
    current.shape = next;
    setLive([...doc.shapes, next]);
  };

  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (current.kind === "crop") {
      setCrop((box) => (box && box.w > 4 && box.h > 4 ? box : null));
      return;
    }
    if (current.kind === "move" && !current.moved) { setLive(null); return; }
    if (current.kind === "draw") {
      const b = bounds(current.shape);
      if (Math.max(b.w, b.h) < 3) { setLive(null); return; }
      setSelected(current.shape.id);
    }
    if (live) setShapes(live);
  };

  /** Bakes the annotations in, then replaces the bitmap with `op` applied. */
  const reshape = async (op: Parameters<typeof transformed>[1]) => {
    setBusy(true);
    try {
      setEditing(null);
      const flat = await flatten(doc, svgRef.current);
      commit({ image: transformed(flat, op), shapes: [] });
      setSelected(null);
      setCrop(null);
      setZoom(null);
    } finally {
      setBusy(false);
    }
  };

  const render = async (format: ImageFormat, quality: number, factor: number) => {
    setEditing(null);
    const flat = await flatten(doc, svgRef.current);
    return canvasBlob(scaled(flat, factor, format === "jpeg"), format, quality);
  };

  const stem = name.replace(/\.[^.]+$/, "");

  const copy = () => {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) { toast.error(t("copyUnsupported")); return; }
    // The item is created inside the gesture so Safari keeps it.
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": render("png", 1, 1) })])
      .then(() => toast.success(t("imageCopied")))
      .catch((cause: unknown) => toast.error(`${t("copyFailed")}: ${cause instanceof Error ? cause.message : String(cause)}`));
  };

  const sendToChat = async () => {
    if (!write) return;
    setBusy(true);
    let clipboard = false;
    try {
      const png = render("png", 1, 1);
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        clipboard = await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]).then(() => true, () => false);
      }
      const saved = await write(`${stem}-edited.png`, await png, false);
      composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${t("chatImageNote", { path: saved.absPath })}\n\n`);
      composer.focus();
      setSavedRev(doc.rev);
      onSaved(saved, false);
      toast.success(clipboard ? t("sentToChatClipboard") : t("sentToChat"));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm(t("discardEdits"))) return;
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (editing || (event.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (mod && key === "y") { event.preventDefault(); redo(); return; }
    if (mod && key === "c") { event.preventDefault(); copy(); return; }
    if (mod && key === "s") { event.preventDefault(); setSaveOpen(true); return; }
    if (mod && (key === "=" || key === "+")) { event.preventDefault(); setZoom(Math.min(8, scale * 1.25)); return; }
    if (mod && key === "-") { event.preventDefault(); setZoom(Math.max(0.05, scale / 1.25)); return; }
    if (mod && key === "0") { event.preventDefault(); setZoom(null); return; }
    if (mod || event.altKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (crop) setCrop(null);
      else if (selected) setSelected(null);
      else close();
      return;
    }
    if (event.key === "Enter" && crop) { event.preventDefault(); void reshape(crop); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && selected) { event.preventDefault(); removeSelected(); return; }
    if (selectedShape && event.key.startsWith("Arrow")) {
      event.preventDefault();
      const d = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -d : event.key === "ArrowRight" ? d : 0;
      const dy = event.key === "ArrowUp" ? -d : event.key === "ArrowDown" ? d : 0;
      setShapes(shapes.map((s) => (s.id === selectedShape.id ? translate(s, dx, dy) : s)));
      return;
    }
    const found = TOOLS.find((item) => item.key === key);
    if (found) { setTool(found.tool); if (found.tool !== "crop") setCrop(null); return; }
    const digit = Number(event.key);
    if (digit >= 1 && digit <= COLORS.length) pickColor(COLORS[digit - 1]!);
  };

  // Pinch and Cmd/Ctrl+wheel zoom; React's wheel listener is passive and can't stop page zoom.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setZoom(Math.min(8, Math.max(0.05, scaleRef.current * Math.exp(-event.deltaY * 0.01))));
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, []);

  const editingShape = shapes.find((s) => s.id === editing && s.type === "text") as Extract<Shape, { type: "text" }> | undefined;
  const finishText = (text: string) => {
    if (!editingShape || finishing.current === editingShape.id) return;
    finishing.current = editingShape.id;
    setEditing(null);
    if (!text.trim()) {
      setShapes(doc.shapes.filter((s) => s.id !== editingShape.id));
      setSelected(null);
      return;
    }
    if (text !== editingShape.text) setShapes(doc.shapes.map((s) => (s.id === editingShape.id ? { ...editingShape, text } : s)));
  };

  const handleSize = 9 / scale;
  const handles = (() => {
    if (!selectedShape || live || editing) return null;
    const s = selectedShape;
    if (s.type === "arrow" || s.type === "line") return [{ id: "p1", x: s.x1, y: s.y1 }, { id: "p2", x: s.x2, y: s.y2 }];
    if (s.type === "rect" || s.type === "ellipse" || s.type === "blur")
      return [{ id: "nw", x: s.x, y: s.y }, { id: "ne", x: s.x + s.w, y: s.y }, { id: "sw", x: s.x, y: s.y + s.h }, { id: "se", x: s.x + s.w, y: s.y + s.h }];
    return [];
  })();
  const selectionBox = selectedShape && !editing ? bounds(selectedShape) : null;
  const toolLabel = (item: (typeof TOOLS)[number]) => `${t(item.label as "toolSelect")} (${item.key.toUpperCase()})`;

  return (
    <div ref={rootRef} className="@container flex h-full min-h-0 flex-col bg-background outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="flex flex-wrap items-center gap-0.5">
          {TOOLS.map((item) => (
            <Tb key={item.tool} label={toolLabel(item)} active={tool === item.tool} onClick={() => { setTool(item.tool); if (item.tool !== "crop") setCrop(null); }}>
              {item.icon ? <ToolIcon icon={item.icon} /> : <span className="flex size-4 items-center justify-center rounded-full border-[1.6px] border-current text-[9px] font-bold">1</span>}
            </Tb>
          ))}
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t("color")}>
          {COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              title={`${t("color")} ${i + 1}`}
              aria-label={`${t("color")} ${i + 1}`}
              onClick={() => pickColor(c)}
              className={cn("size-5 shrink-0 rounded-full border border-black/20 ring-offset-1 ring-offset-background", color === c && "ring-2 ring-foreground")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        {SIZES.map((_, step) => (
          <Tb key={step} label={t(step === 0 ? "sizeS" : step === 1 ? "sizeM" : "sizeL")} active={sizeStep === step} onClick={() => pickSize(step)}>
            <span className="block rounded-full bg-current" style={{ width: 4 + step * 4, height: 4 + step * 4 }} />
          </Tb>
        ))}
        <Tb label={t("fillToggle")} active={fill} onClick={toggleFill}>
          <span className={cn("block size-3.5 rounded-sm border-[1.6px] border-current", fill && "bg-current/40")} />
        </Tb>
        <div className="mx-1 h-5 w-px bg-border" />
        <Tb label={`${t("undo")} (⌘Z)`} disabled={index === 0} onClick={undo}><ToolIcon icon={Undo02Icon} /></Tb>
        <Tb label={`${t("redo")} (⇧⌘Z)`} disabled={index >= history.length - 1} onClick={redo}><ToolIcon icon={Redo02Icon} /></Tb>
        <Tb label={t("rotateLeft")} disabled={busy} onClick={() => void reshape("left")}><ToolIcon icon={RotateLeftIcon} /></Tb>
        <Tb label={t("rotateRight")} disabled={busy} onClick={() => void reshape("right")}><ToolIcon icon={RotateRightIcon} /></Tb>
        <Tb label={t("flipH")} disabled={busy} onClick={() => void reshape("flipX")}><ToolIcon icon={FlipHorizontalIcon} /></Tb>
        <Tb label={t("flipV")} disabled={busy} onClick={() => void reshape("flipY")}><ToolIcon icon={FlipVerticalIcon} /></Tb>
        <div className="mx-1 h-5 w-px bg-border" />
        <Tb label={t("zoomOut")} onClick={() => setZoom(Math.max(0.05, scale / 1.25))}><ToolIcon icon={ZoomOutIcon} /></Tb>
        <button type="button" className="h-8 min-w-12 rounded-md px-1 text-xs tabular-nums text-muted-foreground hover:bg-state-hover" title={t("zoomFit")} onClick={() => setZoom(zoom === null ? 1 : null)}>
          {Math.round(scale * 100)}%
        </button>
        <Tb label={t("zoomIn")} onClick={() => setZoom(Math.min(8, scale * 1.25))}><ToolIcon icon={ZoomInIcon} /></Tb>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8" onClick={close}>{t("cancel")}</Button>
          <span title={`${t("copyImage")} (⌘C)`} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" aria-label={t("copyImage")} onClick={copy}><ToolIcon icon={Copy01Icon} /> <span className="hidden @2xl:inline">{t("copyImage")}</span></Button></span>
          {write ? (
            <span title={t("sendToChatHint")} className="shrink-0"><Button variant="ghost" size="sm" className="h-8 gap-1.5" aria-label={t("sendToChat")} disabled={busy} onClick={() => void sendToChat()}><ToolIcon icon={SentIcon} /> <span className="hidden @lg:inline">{t("sendToChat")}</span></Button></span>
          ) : null}
          <Button size="sm" className="h-8 gap-1.5" disabled={busy} onClick={() => setSaveOpen(true)}><ToolIcon icon={Download01Icon} /> {t("saveImage")}</Button>
        </div>
      </div>

      {crop ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-muted/40 px-2 py-1 text-xs">
          <span className="tabular-nums text-muted-foreground">{Math.round(crop.w)} × {Math.round(crop.h)}</span>
          <Button size="sm" className="h-7" disabled={busy} onClick={() => void reshape(crop)}>{t("applyCrop")} ↵</Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setCrop(null)}>{t("cancel")}</Button>
        </div>
      ) : null}

      <div ref={areaRef} className="min-h-0 flex-1 overflow-auto bg-muted/30">
        <div className="flex min-h-full min-w-full items-center justify-center p-4" style={{ width: "max-content" }}>
          <div className="relative shrink-0 shadow-sm" style={{ width: W * scale, height: H * scale }}>
            <canvas ref={baseRef} className="absolute inset-0 size-full" />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className={cn("absolute inset-0 size-full touch-none select-none", tool === "select" ? "cursor-default" : tool === "text" ? "cursor-text" : "cursor-crosshair")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              // Keeps focus where it is: a click must not steal it from the text being typed.
              onMouseDown={(event) => event.preventDefault()}
              onDoubleClick={(event) => {
                const id = (event.target as Element).closest("[data-id]")?.getAttribute("data-id");
                if (shapes.some((s) => s.id === id && s.type === "text")) startEditing(id!);
              }}
            >
              {shapes.map((s) => (s.id === editing ? null : <ShapeView key={s.id} s={s} hitWidth={14 / scale} />))}
              {selectionBox ? (
                <rect data-overlay="" x={selectionBox.x} y={selectionBox.y} width={selectionBox.w} height={selectionBox.h} fill="none" stroke="#3b82f6" strokeWidth={1 / scale} strokeDasharray={`${4 / scale} ${3 / scale}`} pointerEvents="none" />
              ) : null}
              {handles?.map((h) => (
                <rect key={h.id} data-overlay="" data-handle={h.id} x={h.x - handleSize / 2} y={h.y - handleSize / 2} width={handleSize} height={handleSize} fill="#ffffff" stroke="#3b82f6" strokeWidth={1.5 / scale} className="cursor-move" />
              ))}
              {crop ? (
                <g data-overlay="" pointerEvents="none">
                  <path d={`M0 0H${W}V${H}H0Z M${crop.x} ${crop.y}v${crop.h}h${crop.w}v${-crop.h}Z`} fill="rgba(0,0,0,0.5)" fillRule="evenodd" />
                  <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="#ffffff" strokeWidth={1.5 / scale} strokeDasharray={`${5 / scale} ${4 / scale}`} />
                </g>
              ) : null}
            </svg>
            {editingShape ? (
              <textarea
                ref={(node) => { if (node && document.activeElement !== node) requestAnimationFrame(() => node.focus()); }}
                defaultValue={editingShape.text}
                placeholder={t("textPlaceholder")}
                rows={Math.max(1, editingShape.text.split("\n").length)}
                className="absolute resize-none overflow-hidden border border-dashed border-[#3b82f6] bg-transparent p-0 font-semibold outline-none [field-sizing:content]"
                style={{
                  left: (editingShape.x + textPad(editingShape)) * scale,
                  top: (editingShape.y + textPad(editingShape)) * scale,
                  minWidth: fontSize(editingShape) * scale * 4,
                  fontSize: fontSize(editingShape) * scale,
                  lineHeight: 1.25,
                  fontFamily: FONT,
                  color: editingShape.fill ? contrast(editingShape.color) : editingShape.color,
                  backgroundColor: editingShape.fill ? editingShape.color : "transparent",
                }}
                onBlur={(event) => finishText(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
                    event.preventDefault();
                    event.stopPropagation();
                    finishText(event.currentTarget.value);
                    rootRef.current?.focus();
                  }
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      <SaveDialog
        open={saveOpen}
        onOpenChange={(open) => {
          setSaveOpen(open);
          // Opened from state, not a trigger: give the keyboard shortcuts their focus back.
          if (!open) requestAnimationFrame(() => rootRef.current?.focus());
        }}
        stem={stem}
        size={{ w: W, h: H }}
        overwriteFormat={overwriteFormat}
        canWrite={write !== null}
        onSave={async ({ format, quality, factor, fileName, target }) => {
          setBusy(true);
          try {
            const blob = await render(format, quality, factor);
            if (target === "download") {
              const href = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = href;
              link.download = `${fileName}.${EXT[format]}`;
              document.body.append(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(href), 10_000);
              return;
            }
            const overwrite = target === "overwrite";
            const saved = await write!(overwrite ? name : `${fileName}.${EXT[format]}`, blob, overwrite);
            setSavedRev(doc.rev);
            toast.success(overwrite ? t("imageOverwritten") : t("imageSavedAs", { name: saved.name }));
            onSaved(saved, overwrite);
          } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : String(cause));
          } finally {
            setBusy(false);
            setSaveOpen(false);
          }
        }}
      />
    </div>
  );
}

function SaveDialog({
  open,
  onOpenChange,
  stem,
  size,
  overwriteFormat,
  canWrite,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stem: string;
  size: { w: number; h: number };
  overwriteFormat: ImageFormat | null;
  canWrite: boolean;
  onSave: (options: { format: ImageFormat; quality: number; factor: number; fileName: string; target: "copy" | "overwrite" | "download" }) => void;
}) {
  const [format, setFormat] = useState<ImageFormat>(overwriteFormat ?? "png");
  const [quality, setQuality] = useState(0.9);
  const [factor, setFactor] = useState(1);
  const [fileName, setFileName] = useState(`${stem}-edited`);
  useEffect(() => { if (open) setFileName(`${stem}-edited`); }, [open, stem]);
  const chip = (active: boolean) => cn("h-7 rounded-md border px-2 text-xs", active ? "border-foreground bg-foreground text-background" : "border-input hover:bg-state-hover");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("saveImage")}</DialogTitle>
          <DialogDescription>{Math.round(size.w * factor)} × {Math.round(size.h * factor)} px</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">{t("fileName")}</span>
            <div className="flex items-center gap-1">
              <Input value={fileName} onChange={(event) => setFileName(event.target.value.replace(/[/\\]/g, ""))} />
              <span className="text-muted-foreground">.{EXT[format]}</span>
            </div>
          </label>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">{t("format")}</span>
            <div className="flex gap-1">
              {(["png", "jpeg", "webp"] as const).map((f) => (
                <button key={f} type="button" className={chip(format === f)} onClick={() => setFormat(f)}>{f.toUpperCase()}</button>
              ))}
            </div>
          </div>
          {format !== "png" ? (
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t("quality")}: {Math.round(quality * 100)}%</span>
              <input type="range" min={0.4} max={1} step={0.05} value={quality} onChange={(event) => setQuality(Number(event.target.value))} />
            </label>
          ) : null}
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">{t("scale")}</span>
            <div className="flex gap-1">
              {[1, 0.75, 0.5, 0.25].map((f) => (
                <button key={f} type="button" className={chip(factor === f)} onClick={() => setFactor(f)}>{f * 100}%</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onSave({ format, quality, factor, fileName, target: "download" })}>{t("download")}</Button>
          {canWrite && overwriteFormat === format ? (
            <Button variant="outline" onClick={() => { if (window.confirm(t("overwriteConfirm"))) onSave({ format, quality, factor, fileName, target: "overwrite" }); }}>{t("overwriteOriginal")}</Button>
          ) : null}
          {canWrite ? <Button disabled={!fileName.trim()} onClick={() => onSave({ format, quality, factor, fileName: fileName.trim(), target: "copy" })}>{t("saveCopy")}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
