import type { ReactNode } from "react";
import { hasPictogram, PICTOGRAM_IDS } from "./pictograms-ids.ts";
import { FLOW_SHAPES, shapePath, type FlowShape } from "./shapes.ts";

const W = 32;
const H = 32;
const FG = "var(--foreground)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";
const PRIMARY = "var(--primary)";
const PRIMARY_FG = "var(--primary-foreground)";
const CARD = "var(--card)";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="size-full" aria-hidden fill="none" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

function rect(x: number, y: number, w: number, h: number, props: Record<string, string | number> = {}) {
  return <rect x={x} y={y} width={w} height={h} {...props} />;
}

function line(x1: number, y1: number, x2: number, y2: number, stroke = FG, sw = 1.5) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} />;
}

function boxOutline(x: number, y: number, w: number, h: number, fill = "transparent", rx = 0) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={FG} strokeWidth={1.25} />;
}

function buttonPill(x: number, y: number, w: number, h: number, fill: string, stroke: string, label?: string) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={1.25} />
      {label ? <text x={x + w / 2} y={y + h / 2 + 3.5} textAnchor="middle" fontSize={7} fill={stroke === PRIMARY ? PRIMARY_FG : FG}>{label}</text> : null}
    </>
  );
}

const STICKY: Record<string, string> = {
  "sticky-1": "#fef08a",
  "sticky-2": "#93c5fd",
  "sticky-3": "#86efac",
  "sticky-4": "#f9a8d4",
};

function flowPictogram(shape: FlowShape) {
  const d = shapePath(shape, 28, 22);
  return (
    <Svg>
      <g transform="translate(2 5)">
        <path d={d} fill={CARD} stroke={FG} strokeWidth={1.25} />
      </g>
    </Svg>
  );
}

const RENDER: Record<string, () => ReactNode> = {
  "box-1": () => <Svg>{boxOutline(5, 9, 22, 14)}</Svg>,
  "box-2": () => <Svg>{boxOutline(5, 9, 22, 14, "color-mix(in oklab, var(--foreground) 10%, transparent)", 2)}</Svg>,
  "box-3": () => <Svg>{boxOutline(5, 9, 22, 14, "#1a1a1a", 4)}</Svg>,
  ellipse: () => <Svg><ellipse cx={16} cy={16} rx={11} ry={8} fill="color-mix(in oklab, var(--foreground) 8%, transparent)" stroke={FG} strokeWidth={1.25} /></Svg>,
  placeholder: () => (
    <Svg>
      {boxOutline(4, 7, 24, 18, CARD, 2)}
      <path d="M10 20 L14 14 L18 17 L22 12" stroke={MUTED} strokeWidth={1.25} />
      <circle cx={12} cy={12} r={2} fill={MUTED} />
    </Svg>
  ),
  label: () => <Svg><text x={16} y={18} textAnchor="middle" fontSize={9} fill={FG}>Aa</text></Svg>,
  paragraph: () => (
    <Svg>
      {line(7, 11, 25, 11)}
      {line(7, 16, 25, 16)}
      {line(7, 21, 19, 21)}
    </Svg>
  ),
  "line-h": () => <Svg>{line(4, 16, 28, 16)}</Svg>,
  "line-v": () => <Svg>{line(16, 4, 16, 28)}</Svg>,
  container: () => <Svg><rect x={5} y={7} width={22} height={18} rx={1} stroke={MUTED} strokeWidth={1} strokeDasharray="3 2" fill="transparent" /></Svg>,
  card: () => (
    <Svg>
      {boxOutline(4, 6, 24, 20, CARD, 3)}
      {line(8, 12, 24, 12, MUTED, 1)}
      {line(8, 17, 20, 17, MUTED, 1)}
    </Svg>
  ),
  modal: () => (
    <Svg>
      {boxOutline(3, 5, 26, 22, CARD, 3)}
      {rect(3, 5, 26, 7, { fill: "color-mix(in oklab, var(--foreground) 6%, transparent)", rx: 3 })}
      {line(8, 20, 16, 20, PRIMARY, 2)}
    </Svg>
  ),
  divider: () => <Svg>{line(4, 16, 28, 16, BORDER, 2)}</Svg>,
  "heading-1": () => <Svg><text x={16} y={19} textAnchor="middle" fontSize={11} fontWeight={700} fill={FG}>H1</text></Svg>,
  "heading-2": () => <Svg><text x={16} y={19} textAnchor="middle" fontSize={10} fontWeight={600} fill={FG}>H2</text></Svg>,
  "heading-3": () => <Svg><text x={16} y={19} textAnchor="middle" fontSize={9} fontWeight={600} fill={FG}>H3</text></Svg>,
  text: () => <Svg><text x={16} y={18} textAnchor="middle" fontSize={8} fill={FG}>Text</text></Svg>,
  "button-outline": () => <Svg>{buttonPill(5, 11, 22, 10, "transparent", FG)}</Svg>,
  "button-primary": () => <Svg>{buttonPill(5, 11, 22, 10, PRIMARY, PRIMARY)}</Svg>,
  "button-link": () => (
    <Svg>
      <text x={16} y={18} textAnchor="middle" fontSize={8} fill={PRIMARY}>Link</text>
      <line x1={10} y1={20} x2={22} y2={20} stroke={PRIMARY} strokeWidth={0.75} />
    </Svg>
  ),
  image: () => (
    <Svg>
      {boxOutline(4, 7, 24, 18, CARD, 2)}
      <circle cx={11} cy={13} r={2.5} fill={MUTED} />
      <path d="M6 23 L12 16 L17 19 L26 11 V23 H6 Z" fill="color-mix(in oklab, var(--foreground) 12%, transparent)" stroke={MUTED} strokeWidth={0.75} />
    </Svg>
  ),
  "dynamic-panel": () => (
    <Svg>
      {boxOutline(4, 6, 24, 20, CARD, 2)}
      {rect(4, 6, 24, 6, { fill: BORDER, rx: 2 })}
      {rect(7, 15, 8, 5, { fill: PRIMARY, opacity: 0.35, rx: 1 })}
    </Svg>
  ),
  "repeater-table": () => (
    <Svg>
      {boxOutline(3, 7, 26, 18, CARD, 1)}
      {line(3, 12, 29, 12, BORDER)}
      {line(11, 7, 11, 25, BORDER)}
      {line(19, 7, 19, 25, BORDER)}
    </Svg>
  ),
  "repeater-cards": () => (
    <Svg>
      {boxOutline(4, 9, 10, 14, CARD, 2)}
      {boxOutline(11, 9, 10, 14, CARD, 2)}
      {boxOutline(18, 9, 10, 14, CARD, 2)}
    </Svg>
  ),
  hotspot: () => <Svg><rect x={6} y={8} width={20} height={16} fill={PRIMARY} opacity={0.2} stroke={PRIMARY} strokeWidth={1} strokeDasharray="4 2" /></Svg>,
  "inline-frame": () => (
    <Svg>
      {boxOutline(3, 6, 26, 20, CARD, 2)}
      {rect(6, 9, 20, 3, { fill: BORDER })}
      {line(8, 16, 22, 16, MUTED)}
      {line(8, 19, 18, 19, MUTED)}
    </Svg>
  ),
  snapshot: () => (
    <Svg>
      {boxOutline(5, 8, 22, 16, CARD, 2)}
      <path d="M10 20 L14 14 L18 17 L22 12" stroke={PRIMARY} strokeWidth={1.25} fill="none" />
    </Svg>
  ),
  textfield: () => <Svg>{boxOutline(4, 11, 24, 10, CARD, 2)}{line(7, 16, 18, 16, MUTED)}</Svg>,
  textarea: () => <Svg>{boxOutline(4, 8, 24, 16, CARD, 2)}{line(7, 13, 22, 13, MUTED)}{line(7, 17, 20, 17, MUTED)}</Svg>,
  choice: () => (
    <Svg>
      {boxOutline(4, 11, 24, 10, CARD, 2)}
      <path d="M22 14 L24 16 L22 18" stroke={MUTED} strokeWidth={1.25} fill="none" />
    </Svg>
  ),
  checkbox: () => (
    <Svg>
      {rect(6, 12, 8, 8, { rx: 1, stroke: FG, strokeWidth: 1.25 })}
      <path d="M8 16 L10 18 L14 14" stroke={PRIMARY} strokeWidth={1.5} />
      {line(17, 16, 26, 16, MUTED, 1)}
    </Svg>
  ),
  radio: () => (
    <Svg>
      <circle cx={10} cy={16} r={5} stroke={FG} strokeWidth={1.25} />
      <circle cx={10} cy={16} r={2.5} fill={PRIMARY} />
      {line(17, 16, 26, 16, MUTED, 1)}
    </Svg>
  ),
  switch: () => (
    <Svg>
      <rect x={5} y={12} width={14} height={8} rx={4} fill={PRIMARY} opacity={0.35} stroke={PRIMARY} strokeWidth={1} />
      <circle cx={15} cy={16} r={3} fill={PRIMARY} />
      {line(21, 16, 28, 16, MUTED, 1)}
    </Svg>
  ),
  slider: () => (
    <Svg>
      {line(5, 16, 27, 16, BORDER, 2)}
      <circle cx={18} cy={16} r={3.5} fill={PRIMARY} stroke={PRIMARY_FG} strokeWidth={0.5} />
    </Svg>
  ),
  listbox: () => (
    <Svg>
      {boxOutline(4, 7, 24, 18, CARD, 2)}
      {rect(6, 9, 20, 4, { fill: "color-mix(in oklab, var(--primary) 25%, transparent)", rx: 1 })}
      {line(7, 16, 22, 16, MUTED, 1)}
      {line(7, 20, 20, 20, MUTED, 1)}
    </Svg>
  ),
  "search-field": () => (
    <Svg>
      {boxOutline(4, 11, 24, 10, CARD, 2)}
      <circle cx={9} cy={16} r={2.5} stroke={MUTED} strokeWidth={1} />
      {line(11, 18, 13, 20, MUTED, 1)}
    </Svg>
  ),
  "date-picker": () => (
    <Svg>
      {boxOutline(4, 11, 24, 10, CARD, 2)}
      <rect x={7} y={13} width={4} height={3} fill={MUTED} />
      <rect x={12} y={13} width={4} height={3} fill={MUTED} />
      <rect x={17} y={13} width={4} height={3} fill={MUTED} />
    </Svg>
  ),
  "file-upload": () => (
    <Svg>
      {boxOutline(4, 8, 24, 16, CARD, 2)}
      <path d="M16 11 V19 M13 14 L16 11 L19 14" stroke={PRIMARY} strokeWidth={1.25} />
    </Svg>
  ),
  nav: () => <Svg>{line(5, 16, 10, 16, PRIMARY, 2)}{line(13, 16, 18, 16, MUTED)}{line(21, 16, 26, 16, MUTED)}</Svg>,
  tabs: () => (
    <Svg>
      {line(4, 22, 28, 22, BORDER)}
      {rect(5, 10, 8, 12, { fill: CARD, stroke: BORDER, strokeWidth: 1 })}
      {line(14, 16, 19, 16, MUTED)}
      {line(21, 16, 26, 16, MUTED)}
    </Svg>
  ),
  list: () => (
    <Svg>
      <circle cx={7} cy={11} r={1.2} fill={MUTED} />
      <circle cx={7} cy={16} r={1.2} fill={MUTED} />
      <circle cx={7} cy={21} r={1.2} fill={MUTED} />
      {line(10, 11, 26, 11, MUTED, 1)}
      {line(10, 16, 24, 16, MUTED, 1)}
      {line(10, 21, 22, 21, MUTED, 1)}
    </Svg>
  ),
  table: () => (
    <Svg>
      {boxOutline(3, 7, 26, 18, CARD, 1)}
      {line(3, 12, 29, 12, BORDER)}
      {line(3, 17, 29, 17, BORDER)}
      {line(11, 7, 11, 25, BORDER)}
      {line(19, 7, 19, 25, BORDER)}
    </Svg>
  ),
  tree: () => (
    <Svg>
      {line(8, 10, 8, 22, MUTED)}
      {line(8, 12, 14, 12, MUTED)}
      {line(8, 16, 14, 16, MUTED)}
      {line(8, 20, 14, 20, MUTED)}
      {line(14, 12, 24, 12, MUTED, 1)}
      {line(14, 16, 22, 16, MUTED, 1)}
      {line(14, 20, 20, 20, MUTED, 1)}
    </Svg>
  ),
  "menu-h": () => <Svg>{line(5, 12, 27, 12, MUTED)}{line(5, 16, 27, 16, FG, 1.5)}{line(5, 20, 27, 20, MUTED)}</Svg>,
  "menu-v": () => (
    <Svg>
      {boxOutline(8, 5, 16, 22, CARD, 2)}
      {line(11, 10, 21, 10, MUTED, 1)}
      {line(11, 14, 21, 14, FG, 1.5)}
      {line(11, 18, 21, 18, MUTED, 1)}
    </Svg>
  ),
  breadcrumbs: () => <Svg><text x={16} y={18} textAnchor="middle" fontSize={6.5} fill={MUTED}>A / B / C</text></Svg>,
  pagination: () => (
    <Svg>
      {rect(6, 12, 6, 8, { rx: 1, stroke: BORDER })}
      {rect(13, 12, 6, 8, { rx: 1, fill: PRIMARY, stroke: PRIMARY })}
      {rect(20, 12, 6, 8, { rx: 1, stroke: BORDER })}
    </Svg>
  ),
  header: () => <Svg>{rect(3, 10, 26, 12, { fill: FG, rx: 1 })}{line(8, 16, 18, 16, CARD, 2)}</Svg>,
  avatar: () => <Svg><circle cx={16} cy={16} r={9} fill="color-mix(in oklab, var(--foreground) 10%, transparent)" stroke={FG} strokeWidth={1.25} /><circle cx={16} cy={13} r={3} fill={MUTED} /><path d="M9 24 Q16 19 23 24" stroke={MUTED} strokeWidth={1.25} fill="none" /></Svg>,
  icon: () => <Svg><path d="M16 6 L18 14 L26 16 L18 18 L16 26 L14 18 L6 16 L14 14 Z" fill={PRIMARY} stroke={PRIMARY} strokeWidth={0.5} /></Svg>,
  badge: () => <Svg><rect x={8} y={12} width={16} height={8} rx={4} fill={PRIMARY} /><text x={16} y={17.5} textAnchor="middle" fontSize={6} fill={PRIMARY_FG}>1</text></Svg>,
  progress: () => (
    <Svg>
      {rect(4, 14, 24, 4, { rx: 2, fill: BORDER })}
      {rect(4, 14, 14, 4, { rx: 2, fill: PRIMARY })}
    </Svg>
  ),
  alert: () => (
    <Svg>
      {boxOutline(3, 8, 26, 16, "color-mix(in oklab, var(--primary) 12%, transparent)", 2)}
      <circle cx={8} cy={13} r={2} fill={PRIMARY} />
      {line(12, 13, 24, 13, FG, 1)}
      {line(12, 17, 20, 17, MUTED, 1)}
    </Svg>
  ),
  tooltip: () => (
    <Svg>
      <rect x={6} y={9} width={20} height={10} rx={2} fill={FG} />
      <path d="M14 19 L16 22 L18 19" fill={FG} />
      <text x={16} y={16} textAnchor="middle" fontSize={6} fill={CARD}>Tip</text>
    </Svg>
  ),
  "arrow-h": () => <Svg><path d="M4 16 H22 M18 12 L24 16 L18 20" stroke={FG} strokeWidth={1.5} fill="none" /></Svg>,
  "arrow-v": () => <Svg><path d="M16 4 V22 M12 18 L16 24 L20 18" stroke={FG} strokeWidth={1.5} fill="none" /></Svg>,
  "marker-circle": () => <Svg><circle cx={16} cy={16} r={8} fill="#ef4444" /><text x={16} y={19} textAnchor="middle" fontSize={8} fill="#fff">1</text></Svg>,
  "marker-drop": () => <Svg><path d="M16 6 C12 12 8 14 8 18 A8 8 0 0 0 24 18 C24 14 20 12 16 6 Z" fill="#ef4444" /><text x={16} y={20} textAnchor="middle" fontSize={7} fill="#fff">1</text></Svg>,
  instance: () => (
    <Svg>
      <rect x={6} y={8} width={20} height={14} rx={2} stroke={FG} strokeWidth={1.25} fill="none" strokeDasharray="3 2" />
      <rect x={10} y={12} width={8} height={3} rx={0.5} fill={FG} opacity={0.35} />
      <rect x={10} y={17} width={12} height={2} rx={0.5} fill={FG} opacity={0.25} />
    </Svg>
  ),
  connector: () => (
    <Svg>
      <rect x={6} y={10} width={10} height={8} rx={1} stroke={FG} strokeWidth={1.25} />
      <rect x={16} y={14} width={10} height={8} rx={1} stroke={FG} strokeWidth={1.25} />
      <path d="M11 14 V18 H18 V18" stroke={PRIMARY} strokeWidth={1.5} markerEnd="url(#pict-conn-arrow)" />
      <defs>
        <marker id="pict-conn-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
          <path d="M0,0 L4,2 L0,4 z" fill={PRIMARY} />
        </marker>
      </defs>
    </Svg>
  ),
};

for (const shape of FLOW_SHAPES) {
  RENDER[`flow-${shape}`] = () => flowPictogram(shape);
}

for (const id of Object.keys(STICKY)) {
  RENDER[id] = () => (
    <Svg>
      <path d="M6 8 H26 L24 24 H8 L6 8 Z" fill={STICKY[id]} stroke="color-mix(in oklab, var(--foreground) 35%, transparent)" strokeWidth={1} />
      {line(10, 14, 22, 14, "color-mix(in oklab, #000 25%, transparent)", 1)}
      {line(10, 18, 18, 18, "color-mix(in oklab, #000 25%, transparent)", 1)}
    </Svg>
  );
}

export { hasPictogram, PICTOGRAM_IDS } from "./pictograms-ids.ts";

export function Pictogram({ id, className }: { id: string; className?: string }) {
  const render = RENDER[id];
  if (!render) {
    return (
      <div className={className} aria-hidden>
        <Svg>{boxOutline(8, 8, 16, 16, BORDER, 2)}</Svg>
      </div>
    );
  }
  return <div className={className} aria-hidden>{render()}</div>;
}
