// Paint document: blank-canvas sidecar plus an object-eraser hit test.
import { z } from "zod";

export const PAINT_FORMAT = "bb-paint" as const;
export const PAINT_VERSION = 1;

export const PAINT_SIZE_PRESETS = {
  wide: { width: 1280, height: 800 },
  hd: { width: 1920, height: 1080 },
  square: { width: 800, height: 800 },
} as const;

export const PAINT_BACKGROUNDS = {
  white: "#ffffff",
  transparent: "transparent",
  dark: "#111827",
} as const;

export const PAINT_SIZES = [1, 2, 4, 8, 16, 24] as const;

type Box = { x: number; y: number; w: number; h: number };
type Common = { id: string; color: string; size: number };

export type PaintShape = Common &
  (
    | ({ type: "rect" | "ellipse" | "blur"; fill: boolean } & Box)
    | { type: "arrow" | "line"; x1: number; y1: number; x2: number; y2: number }
    | { type: "pen" | "marker"; points: number[] }
    | { type: "text"; x: number; y: number; text: string; fill: boolean }
    | { type: "step"; x: number; y: number; n: number }
  );

export type PaintCanvas = { width: number; height: number; background: string };

export type PaintDoc = {
  format: typeof PAINT_FORMAT;
  version: typeof PAINT_VERSION;
  name: string;
  canvas: PaintCanvas;
  shapes: PaintShape[];
};

const finite = z.number().finite();
const common = { id: z.string().min(1).max(128), color: z.string().min(1).max(64), size: z.number().positive().max(1024) };

const shapeSchema: z.ZodType<PaintShape> = z.union([
  z.object({ ...common, type: z.literal("rect"), fill: z.boolean(), x: finite, y: finite, w: finite, h: finite }).strict(),
  z.object({ ...common, type: z.literal("ellipse"), fill: z.boolean(), x: finite, y: finite, w: finite, h: finite }).strict(),
  z.object({ ...common, type: z.literal("blur"), fill: z.boolean(), x: finite, y: finite, w: finite, h: finite }).strict(),
  z.object({ ...common, type: z.literal("arrow"), x1: finite, y1: finite, x2: finite, y2: finite }).strict(),
  z.object({ ...common, type: z.literal("line"), x1: finite, y1: finite, x2: finite, y2: finite }).strict(),
  z
    .object({ ...common, type: z.literal("pen"), points: z.array(finite).min(2) })
    .strict()
    .refine((s) => s.points.length % 2 === 0, "pen points must be x,y pairs"),
  z
    .object({ ...common, type: z.literal("marker"), points: z.array(finite).min(2) })
    .strict()
    .refine((s) => s.points.length % 2 === 0, "marker points must be x,y pairs"),
  z.object({ ...common, type: z.literal("text"), x: finite, y: finite, text: z.string().max(8000), fill: z.boolean() }).strict(),
  z.object({ ...common, type: z.literal("step"), x: finite, y: finite, n: z.number().int().positive().max(9999) }).strict(),
]);

const paintSchema = z
  .object({
    format: z.literal(PAINT_FORMAT),
    version: z.literal(PAINT_VERSION),
    name: z.string().min(1).max(200),
    canvas: z
      .object({
        width: z.number().int().min(1).max(8192),
        height: z.number().int().min(1).max(8192),
        background: z.string().min(1).max(64),
      })
      .strict(),
    shapes: z.array(shapeSchema).max(4000),
  })
  .strict();

export function newPaintDoc(name = "Untitled", canvas: PaintCanvas = { ...PAINT_SIZE_PRESETS.wide, background: PAINT_BACKGROUNDS.white }): PaintDoc {
  return { format: PAINT_FORMAT, version: PAINT_VERSION, name, canvas, shapes: [] };
}

export function parsePaintDoc(input: unknown): PaintDoc {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  return paintSchema.parse(raw);
}

export function clonePaintDoc(doc: PaintDoc): PaintDoc {
  return structuredClone(doc);
}

const fontSize = (s: Common) => Math.max(12, s.size * 5);
const stepRadius = (s: Common) => s.size * 2.6 + 6;

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distToPolyline(px: number, py: number, points: readonly number[]): number {
  if (points.length < 2) return Infinity;
  if (points.length < 4) return Math.hypot(px - points[0]!, py - points[1]!);
  let best = Infinity;
  for (let i = 0; i + 3 < points.length; i += 2) {
    best = Math.min(best, distToSeg(px, py, points[i]!, points[i + 1]!, points[i + 2]!, points[i + 3]!));
  }
  return best;
}

function inBox(px: number, py: number, box: Box, pad: number): boolean {
  return px >= box.x - pad && py >= box.y - pad && px <= box.x + box.w + pad && py <= box.y + box.h + pad;
}

function strokePad(s: PaintShape): number {
  if (s.type === "marker") return (s.size * 5) / 2;
  if (s.type === "text" || s.type === "step" || s.type === "blur") return 0;
  return s.size / 2;
}

function textBox(s: Extract<PaintShape, { type: "text" }>): Box {
  const fs = fontSize(s);
  const pad = fs * 0.35;
  const lines = s.text.split("\n");
  const maxLen = Math.max(1, ...lines.map((line) => line.length));
  return { x: s.x, y: s.y, w: Math.max(fs, maxLen * fs * 0.7) + pad * 2, h: lines.length * fs * 1.25 + pad * 2 };
}

/** True when the eraser circle at `(x, y)` with `radius` touches the shape. */
export function shapeHitsPoint(shape: PaintShape, x: number, y: number, radius: number): boolean {
  const pad = Math.max(0, radius) + strokePad(shape);
  switch (shape.type) {
    case "rect":
    case "blur":
      return inBox(x, y, shape, pad);
    case "ellipse": {
      const rx = shape.w / 2 + pad;
      const ry = shape.h / 2 + pad;
      if (rx <= 0 || ry <= 0) return Math.hypot(x - shape.x, y - shape.y) <= pad;
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }
    case "arrow":
    case "line":
      return distToSeg(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= pad;
    case "pen":
    case "marker":
      return distToPolyline(x, y, shape.points) <= pad;
    case "text":
      return inBox(x, y, textBox(shape), pad);
    case "step":
      return Math.hypot(x - shape.x, y - shape.y) <= stepRadius(shape) + Math.max(0, radius);
  }
}

/** Drops every shape the eraser circle touches; order of the rest is kept. */
export function eraseShapesAt<T extends PaintShape>(shapes: readonly T[], x: number, y: number, radius: number): T[] {
  return shapes.filter((shape) => !shapeHitsPoint(shape, x, y, radius));
}
