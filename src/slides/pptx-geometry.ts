// Office Viewer — PowerPoint shape outlines: preset shapes and custom paths
// turned into SVG path data in pixels. Presets are the common ones; any other
// preset is drawn as its bounding rectangle.
import { kid, kids, type Xml } from "./xml.ts";

export type Geometry = { prst: string; adj: Record<string, number> } | { cust: Xml };
/** An outline: SVG path data plus how to draw it. `angle` marks line ends so arrowheads can be placed. */
export type Outline = { d: string; rect?: boolean; evenodd?: boolean; line?: boolean; start?: { x: number; y: number; angle: number }; end?: { x: number; y: number; angle: number } };

type Point = [number, number];
const num = (value: number) => Math.round(value * 100) / 100;
const poly = (points: Point[]) => `M${points.map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}Z`;
const rectPath = (w: number, h: number) => `M0 0H${num(w)}V${num(h)}H0Z`;

function roundRectPath(w: number, h: number, radius: number) {
  const r = num(Math.max(0, Math.min(radius, w / 2, h / 2)));
  return `M${r} 0H${num(w - r)}A${r} ${r} 0 0 1 ${num(w)} ${r}V${num(h - r)}A${r} ${r} 0 0 1 ${num(w - r)} ${num(h)}H${r}A${r} ${r} 0 0 1 0 ${num(h - r)}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return `M${num(cx - rx)} ${num(cy)}A${num(rx)} ${num(ry)} 0 1 1 ${num(cx + rx)} ${num(cy)}A${num(rx)} ${num(ry)} 0 1 1 ${num(cx - rx)} ${num(cy)}Z`;
}

/** Inner-to-outer radius ratio of the star presets (the file stores it as `adj` over 50000). */
const STAR_INNER: Record<string, number> = { star4: 0.25, star5: 0.382, star6: 0.577, star7: 0.692, star8: 0.75, star10: 0.85, star12: 0.75, star16: 0.75, star24: 0.75, star32: 0.75 };

function starPath(prst: string, w: number, h: number, adj?: number) {
  const points = Number(prst.slice(4));
  const inner = adj === undefined ? STAR_INNER[prst] : adj / 50000;
  const out: Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? 1 : inner;
    const angle = (Math.PI * i) / points;
    out.push([w / 2 + (w / 2) * radius * Math.sin(angle), h / 2 - (h / 2) * radius * Math.cos(angle)]);
  }
  return poly(out);
}

/** A right-pointing block arrow in a `w`×`h` box; the other directions are this one turned around. */
function arrowPoints(w: number, h: number, thickness: number, head: number): Point[] {
  const half = (h * thickness) / 200000;
  const length = Math.min(w, (Math.min(w, h) * head) / 100000);
  return [[0, h / 2 - half], [w - length, h / 2 - half], [w - length, 0], [w, h / 2], [w - length, h], [w - length, h / 2 + half], [0, h / 2 + half]];
}

function presetOutline(prst: string, w: number, h: number, adj: Record<string, number>): Outline {
  const ss = Math.min(w, h);
  const a = (name: string, fallback: number) => adj[name] ?? fallback;
  switch (prst) {
    case "roundRect":
    case "flowChartAlternateProcess":
      return { d: roundRectPath(w, h, (ss * a("adj", 16667)) / 100000) };
    case "flowChartTerminator":
      return { d: roundRectPath(w, h, h / 2) };
    case "ellipse":
      return { d: ellipsePath(w / 2, h / 2, w / 2, h / 2) };
    case "donut": {
      const hole = (ss * a("adj", 25000)) / 100000;
      return { d: ellipsePath(w / 2, h / 2, w / 2, h / 2) + ellipsePath(w / 2, h / 2, w / 2 - hole, h / 2 - hole), evenodd: true };
    }
    case "triangle":
      return { d: poly([[(w * a("adj", 50000)) / 100000, 0], [w, h], [0, h]]) };
    case "rtTriangle":
      return { d: poly([[0, 0], [w, h], [0, h]]) };
    case "diamond":
    case "flowChartDecision":
      return { d: poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) };
    case "parallelogram": {
      const x = (ss * a("adj", 25000)) / 100000;
      return { d: poly([[x, 0], [w, 0], [w - x, h], [0, h]]) };
    }
    case "flowChartData":
      return { d: poly([[w * 0.2, 0], [w, 0], [w * 0.8, h], [0, h]]) };
    case "trapezoid": {
      const x = (ss * a("adj", 25000)) / 100000;
      return { d: poly([[x, 0], [w - x, 0], [w, h], [0, h]]) };
    }
    case "pentagon":
      return { d: poly([[w / 2, 0], [w, h * 0.382], [w * 0.809, h], [w * 0.191, h], [0, h * 0.382]]) };
    case "homePlate": {
      const x = w - (ss * a("adj", 50000)) / 100000;
      return { d: poly([[0, 0], [x, 0], [w, h / 2], [x, h], [0, h]]) };
    }
    case "chevron": {
      const x = (ss * a("adj", 50000)) / 100000;
      return { d: poly([[0, 0], [w - x, 0], [w, h / 2], [w - x, h], [0, h], [x, h / 2]]) };
    }
    case "hexagon": {
      const x = (ss * a("adj", 25000)) / 100000;
      return { d: poly([[x, 0], [w - x, 0], [w, h / 2], [w - x, h], [x, h], [0, h / 2]]) };
    }
    case "octagon": {
      const x = (ss * a("adj", 29289)) / 100000;
      return { d: poly([[x, 0], [w - x, 0], [w, x], [w, h - x], [w - x, h], [x, h], [0, h - x], [0, x]]) };
    }
    case "plus": {
      const x = (ss * a("adj", 25000)) / 100000;
      return { d: poly([[x, 0], [w - x, 0], [w - x, x], [w, x], [w, h - x], [w - x, h - x], [w - x, h], [x, h], [x, h - x], [0, h - x], [0, x], [x, x]]) };
    }
    case "rightArrow":
      return { d: poly(arrowPoints(w, h, a("adj1", 50000), a("adj2", 50000))) };
    case "leftArrow":
      return { d: poly(arrowPoints(w, h, a("adj1", 50000), a("adj2", 50000)).map(([x, y]): Point => [w - x, y])) };
    case "upArrow":
      return { d: poly(arrowPoints(h, w, a("adj1", 50000), a("adj2", 50000)).map(([x, y]): Point => [y, h - x])) };
    case "downArrow":
      return { d: poly(arrowPoints(h, w, a("adj1", 50000), a("adj2", 50000)).map(([x, y]): Point => [y, x])) };
    case "line":
    case "straightConnector1":
      return { d: `M0 0L${num(w)} ${num(h)}`, line: true, start: { x: 0, y: 0, angle: Math.atan2(-h, -w) }, end: { x: w, y: h, angle: Math.atan2(h, w) } };
    case "bentConnector2":
      return { d: `M0 0H${num(w)}V${num(h)}`, line: true, start: { x: 0, y: 0, angle: Math.PI }, end: { x: w, y: h, angle: Math.PI / 2 } };
    case "bentConnector3": {
      const x = (w * a("adj1", 50000)) / 100000;
      return { d: `M0 0H${num(x)}V${num(h)}H${num(w)}`, line: true, start: { x: 0, y: 0, angle: Math.PI }, end: { x: w, y: h, angle: 0 } };
    }
    default:
      if (/^star\d+$/.test(prst) && prst in STAR_INNER) return { d: starPath(prst, w, h, adj.adj) };
      return { d: rectPath(w, h), rect: true };
  }
}

/** Path data of a `<a:custGeom>`: lines, curves and arcs scaled from the path's own coordinate space to the box. */
function customOutline(geometry: Xml, w: number, h: number): Outline {
  const parts: string[] = [];
  for (const path of kids(kid(geometry, "a:pathLst"), "a:path")) {
    const sx = w / (Number(path.attrs.w) || w || 1);
    const sy = h / (Number(path.attrs.h) || h || 1);
    const at = (node: Xml): Point => [Number(node.attrs.x) * sx, Number(node.attrs.y) * sy];
    let current: Point = [0, 0];
    for (const command of path.kids) {
      const points = kids(command, "a:pt").map(at);
      if (command.name === "a:moveTo" && points[0]) {
        current = points[0];
        parts.push(`M${num(current[0])} ${num(current[1])}`);
      } else if (command.name === "a:lnTo" && points[0]) {
        current = points[0];
        parts.push(`L${num(current[0])} ${num(current[1])}`);
      } else if (command.name === "a:cubicBezTo" && points.length === 3) {
        current = points[2];
        parts.push(`C${points.map(([x, y]) => `${num(x)} ${num(y)}`).join(" ")}`);
      } else if (command.name === "a:quadBezTo" && points.length === 2) {
        current = points[1];
        parts.push(`Q${points.map(([x, y]) => `${num(x)} ${num(y)}`).join(" ")}`);
      } else if (command.name === "a:arcTo") {
        const rx = Number(command.attrs.wR) * sx;
        const ry = Number(command.attrs.hR) * sy;
        const start = (Number(command.attrs.stAng) / 60000) * (Math.PI / 180);
        const sweep = (Number(command.attrs.swAng) / 60000) * (Math.PI / 180);
        if (!(rx > 0 && ry > 0)) continue;
        // Angles in the file are visual angles; convert them to the ellipse parameter before locating points.
        const parameter = (angle: number) => {
          const t = Math.atan2(rx * Math.sin(angle), ry * Math.cos(angle));
          return t + 2 * Math.PI * Math.round((angle - t) / (2 * Math.PI));
        };
        const t1 = parameter(start);
        const t2 = parameter(start + sweep);
        const cx = current[0] - rx * Math.cos(t1);
        const cy = current[1] - ry * Math.sin(t1);
        current = [cx + rx * Math.cos(t2), cy + ry * Math.sin(t2)];
        parts.push(`A${num(rx)} ${num(ry)} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep > 0 ? 1 : 0} ${num(current[0])} ${num(current[1])}`);
      } else if (command.name === "a:close") parts.push("Z");
    }
  }
  return { d: parts.join("") || rectPath(w, h), rect: parts.length === 0 };
}

export function outline(geometry: Geometry | undefined, w: number, h: number): Outline {
  if (!geometry) return { d: rectPath(w, h), rect: true };
  return "cust" in geometry ? customOutline(geometry.cust, w, h) : presetOutline(geometry.prst, w, h, geometry.adj);
}

/** The share of the box each side that text keeps clear of, for shapes whose corners are cut away. */
export function textInset(geometry: Geometry | undefined): number {
  if (!geometry || "cust" in geometry) return 0;
  if (geometry.prst === "ellipse") return 0.1464;
  if (geometry.prst === "diamond" || geometry.prst === "flowChartDecision") return 0.25;
  return 0;
}

/** A filled triangle for an arrowhead: tip at `at`, pointing along `angle`. */
export function arrowhead(at: { x: number; y: number }, angle: number, size: number): string {
  const back = (side: number): Point => [at.x - size * Math.cos(angle) + side * Math.sin(angle) * (size / 2), at.y - size * Math.sin(angle) - side * Math.cos(angle) * (size / 2)];
  return poly([[at.x, at.y], back(1), back(-1)]);
}
