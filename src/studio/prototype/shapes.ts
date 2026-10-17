// Flowchart outline paths scaled to w×h (SVG path d, no fill).

export const FLOW_SHAPES = [
  "rectangle",
  "stacked-rectangle",
  "rounded",
  "stacked-rounded",
  "beveled",
  "diamond",
  "file",
  "stacked-file",
  "bracket",
  "semicircle",
  "triangle",
  "trapezoid",
  "ellipse",
  "hexagon",
  "parallelogram",
  "actor",
  "database",
  "subroutine",
  "delay",
  "document",
  "multi-document",
  "off-page",
  "manual-input",
  "stored-data",
  "internal-storage",
  "offline-storage",
  "display",
  "sort",
  "collate",
  "summing-junction",
  "logical-or",
  "magnetic-tape",
  "punched-tape",
  "punched-card",
  "keying",
] as const;

export type FlowShape = (typeof FLOW_SHAPES)[number];

const inset = 2;

function rect(w: number, h: number, dx = 0, dy = 0, rw = w, rh = h): string {
  return `M ${dx + inset} ${dy + inset} H ${dx + rw - inset} V ${dy + rh - inset} H ${dx + inset} Z`;
}

function roundedRect(w: number, h: number, r: number, dx = 0, dy = 0, rw = w, rh = h): string {
  const x1 = dx + inset;
  const y1 = dy + inset;
  const x2 = dx + rw - inset;
  const y2 = dy + rh - inset;
  const cr = Math.min(r, (x2 - x1) / 2, (y2 - y1) / 2);
  return `M ${x1 + cr} ${y1} H ${x2 - cr} Q ${x2} ${y1} ${x2} ${y1 + cr} V ${y2 - cr} Q ${x2} ${y2} ${x2 - cr} ${y2} H ${x1 + cr} Q ${x1} ${y2} ${x1} ${y2 - cr} V ${y1 + cr} Q ${x1} ${y1} ${x1 + cr} ${y1} Z`;
}

const BUILDERS: Record<FlowShape, (w: number, h: number) => string> = {
  rectangle: (w, h) => rect(w, h),
  "stacked-rectangle": (w, h) => `${rect(w, h, 6, 6, w - 6, h - 6)} ${rect(w, h, 0, 0, w - 6, h - 6)}`,
  rounded: (w, h) => roundedRect(w, h, Math.min(12, w / 6, h / 4)),
  "stacked-rounded": (w, h) =>
    `${roundedRect(w, h, 8, 6, 6, w - 6, h - 6)} ${roundedRect(w, h, 8, 0, 0, w - 6, h - 6)}`,
  beveled: (w, h) => {
    const c = Math.min(16, w / 4, h / 3);
    return `M ${inset + c} ${inset} H ${w - inset - c} L ${w - inset} ${inset + c} V ${h - inset - c} L ${w - inset - c} ${h - inset} H ${inset + c} L ${inset} ${h - inset - c} V ${inset + c} Z`;
  },
  diamond: (w, h) => `M ${w / 2} ${inset} L ${w - inset} ${h / 2} L ${w / 2} ${h - inset} L ${inset} ${h / 2} Z`,
  file: (w, h) => {
    const fold = Math.min(18, w / 4);
    return `M ${inset} ${inset} H ${w - inset - fold} L ${w - inset} ${inset + fold} V ${h - inset} H ${inset} Z M ${w - inset - fold} ${inset} V ${inset + fold} H ${w - inset}`;
  },
  "stacked-file": (w, h) => {
    const fold = Math.min(14, w / 5);
    const back = `M ${inset + 6} ${inset + 6} H ${w - inset - fold + 2} L ${w - inset + 2} ${inset + fold + 6} V ${h - inset} H ${inset + 6} Z`;
    const front = `M ${inset} ${inset} H ${w - inset - fold - 6} L ${w - inset - 6} ${inset + fold} V ${h - inset - 6} H ${inset} Z M ${w - inset - fold - 6} ${inset} V ${inset + fold} H ${w - inset - 6}`;
    return `${back} ${front}`;
  },
  bracket: (w, h) => {
    const m = Math.min(14, w / 5);
    return `M ${inset + m} ${inset} H ${w - inset - m} V ${inset + m} H ${w - inset} V ${h - inset - m} H ${w - inset - m} V ${h - inset} H ${inset + m} V ${h - inset - m} H ${inset} V ${inset + m} H ${inset + m} Z`;
  },
  semicircle: (w, h) => `M ${inset} ${h - inset} H ${w - inset} A ${(w - inset * 2) / 2} ${(w - inset * 2) / 2} 0 0 0 ${inset} ${h - inset} Z`,
  triangle: (w, h) => `M ${w / 2} ${inset} L ${w - inset} ${h - inset} H ${inset} Z`,
  trapezoid: (w, h) => {
    const t = Math.min(20, w / 4);
    return `M ${inset + t} ${inset} H ${w - inset - t} L ${w - inset} ${h - inset} H ${inset} Z`;
  },
  ellipse: (w, h) => {
    const rx = (w - inset * 2) / 2;
    const ry = (h - inset * 2) / 2;
    return `M ${w / 2} ${inset} A ${rx} ${ry} 0 1 1 ${w / 2 - 0.01} ${inset} Z`;
  },
  hexagon: (w, h) => {
    const s = Math.min(16, w / 6);
    return `M ${inset + s} ${inset} H ${w - inset - s} L ${w - inset} ${h / 2} L ${w - inset - s} ${h - inset} H ${inset + s} L ${inset} ${h / 2} Z`;
  },
  parallelogram: (w, h) => {
    const s = Math.min(18, w / 4);
    return `M ${inset + s} ${inset} H ${w - inset} L ${w - inset - s} ${h - inset} H ${inset} Z`;
  },
  actor: (w, h) => {
    const cx = w / 2;
    const head = h * 0.22;
    const r = head / 2;
    return `M ${cx} ${inset + r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${inset + r} M ${cx} ${inset + head * 2} V ${h - inset - 8} M ${cx - w * 0.22} ${inset + head * 3} H ${cx + w * 0.22} M ${cx} ${h - inset - 8} L ${inset + 6} ${h - inset} M ${cx} ${h - inset - 8} L ${w - inset - 6} ${h - inset}`;
  },
  database: (w, h) => {
    const rx = (w - inset * 2) / 2;
    const ry = Math.min(10, h / 8);
    const top = inset + ry;
    const bottom = h - inset;
    return `M ${w / 2 - rx} ${top} A ${rx} ${ry} 0 0 0 ${w / 2 + rx} ${top} A ${rx} ${ry} 0 0 0 ${w / 2 - rx} ${top} M ${w / 2 - rx} ${top} V ${bottom - ry} A ${rx} ${ry} 0 0 0 ${w / 2 + rx} ${bottom - ry} V ${top}`;
  },
  subroutine: (w, h) => {
    const n = Math.min(12, w / 8);
    return `M ${inset + n} ${inset} H ${w - inset - n} Q ${w - inset} ${inset} ${w - inset} ${inset + n} V ${h - inset - n} Q ${w - inset} ${h - inset} ${w - inset - n} ${h - inset} H ${inset + n} Q ${inset} ${h - inset} ${inset} ${h - inset - n} V ${inset + n} Q ${inset} ${inset} ${inset + n} ${inset} Z`;
  },
  delay: (w, h) => {
    const r = Math.min(h / 2 - inset, w / 3);
    return `M ${inset} ${inset} H ${w - inset - r} A ${r} ${r} 0 0 1 ${w - inset - r} ${h - inset} H ${inset} Z`;
  },
  document: (w, h) => {
    const wave = Math.min(10, h / 6);
    return `M ${inset} ${inset} H ${w - inset} V ${h - inset - wave} Q ${w * 0.75} ${h - inset} ${w / 2} ${h - inset - wave} Q ${w * 0.25} ${h - inset - wave * 2} ${inset} ${h - inset - wave} Z`;
  },
  "multi-document": (w, h) => {
    const doc = BUILDERS.document(w - 8, h - 8);
    return `${rect(w, h, 8, 8, w - 8, h - 8)} ${doc}`;
  },
  "off-page": (w, h) => {
    const p = Math.min(16, h / 3);
    return `M ${inset} ${inset} H ${w - inset} V ${h - inset - p} L ${w / 2} ${h - inset} L ${inset} ${h - inset - p} Z`;
  },
  "manual-input": (w, h) => {
    const s = Math.min(16, w / 5);
    return `M ${inset} ${h - inset} L ${inset + s} ${inset} H ${w - inset} V ${h - inset} Z`;
  },
  "stored-data": (w, h) => {
    const s = Math.min(18, w / 4);
    return `M ${inset + s} ${inset} H ${w - inset} V ${h - inset} H ${inset} L ${inset + s} ${inset} Z`;
  },
  "internal-storage": (w, h) => {
    const bar = Math.min(14, w / 5);
    return `${rect(w, h)} M ${inset + bar} ${inset} V ${h - inset}`;
  },
  "offline-storage": (w, h) => {
    const bar = Math.min(14, w / 5);
    return `${rect(w, h)} M ${w - inset - bar} ${inset} V ${h - inset}`;
  },
  display: (w, h) => {
    const arc = Math.min(12, w / 6);
    return `M ${inset} ${inset} H ${w - inset} V ${h - inset - arc} Q ${w / 2} ${h - inset + arc / 2} ${inset} ${h - inset - arc} Z`;
  },
  sort: (w, h) => `M ${w / 2} ${inset} L ${w - inset} ${h - inset} H ${inset} Z`,
  collate: (w, h) => {
    const off = 8;
    return `${rect(w - off, h - off, off, off)} ${rect(w - off, h - off, 0, 0)}`;
  },
  "summing-junction": (w, h) => {
    const r = Math.min(w, h) / 2 - inset;
    const cx = w / 2;
    const cy = h / 2;
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} M ${cx - r * 0.5} ${cy} H ${cx + r * 0.5} M ${cx} ${cy - r * 0.5} V ${cy + r * 0.5}`;
  },
  "logical-or": (w, h) => {
    const rx = (w - inset * 2) / 2;
    const ry = (h - inset * 2) / 2;
    return `M ${w / 2} ${inset} Q ${w - inset} ${h / 2} ${w / 2} ${h - inset} Q ${inset} ${h / 2} ${w / 2} ${inset} Z`;
  },
  "magnetic-tape": (w, h) => {
    const r = Math.min(h / 2 - inset, 14);
    return `M ${inset + r} ${inset} H ${w - inset - r} A ${r} ${r} 0 0 1 ${w - inset - r} ${h - inset} H ${inset + r} A ${r} ${r} 0 0 1 ${inset + r} ${inset} Z`;
  },
  "punched-tape": (w, h) => {
    const wave = Math.min(8, h / 8);
    return `M ${inset} ${inset + wave} Q ${w / 4} ${inset} ${w / 2} ${inset + wave} T ${w - inset} ${inset + wave} V ${h - inset - wave} Q ${w * 0.75} ${h - inset} ${w / 2} ${h - inset - wave} T ${inset} ${h - inset - wave} Z`;
  },
  "punched-card": (w, h) => {
    const notch = Math.min(12, w / 6);
    return `M ${inset} ${inset} H ${w - inset - notch} L ${w - inset} ${inset + notch} V ${h - inset} H ${inset} Z`;
  },
  keying: (w, h) => {
    const mid = h * 0.55;
    return `M ${inset} ${inset} H ${w - inset} V ${mid} H ${w / 2 + 10} L ${w / 2} ${h - inset} L ${w / 2 - 10} ${mid} H ${inset} Z`;
  },
};

export function shapePath(shape: FlowShape, w: number, h: number): string {
  const build = BUILDERS[shape];
  if (!build) return rect(w, h);
  const path = build(Math.max(1, w), Math.max(1, h)).trim();
  return path.length > 0 ? path : rect(w, h);
}

export function isFlowShape(value: string): value is FlowShape {
  return (FLOW_SHAPES as readonly string[]).includes(value);
}
