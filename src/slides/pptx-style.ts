// Office Viewer — PowerPoint colors, fills and lines: the theme palette,
// scheme-color mapping, color transforms (lumMod, tint, alpha…) and the
// fill/line styles a shape inherits from the theme.
import { kid, kids, type Xml } from "./xml.ts";

export type Rgba = [number, number, number, number];
export type Theme = { colors: Record<string, string>; major: string; minor: string; fills: Xml[]; lines: Xml[]; backgrounds: Xml[] };
/** Everything color resolution needs: the theme and the master's color map (`bg1` → `lt1`…). */
export type Colors = { theme: Theme; map: Record<string, string> };
export type Fill = { kind: "none" } | { kind: "solid"; color: string } | { kind: "grad"; angle: number; radial: boolean; stops: { pos: number; color: string }[] } | { kind: "image"; url: string };
export type Line = { width: number; color: string; dash: number[]; head: boolean; tail: boolean };

export const DEFAULT_MAP: Record<string, string> = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };
const PRESET_COLORS: Record<string, string> = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080", grey: "808080" };

export const hex = (value: string | undefined): Rgba | undefined => {
  const match = /^[0-9a-f]{6}$/i.exec(value ?? "");
  return match ? [parseInt(value!.slice(0, 2), 16), parseInt(value!.slice(2, 4), 16), parseInt(value!.slice(4, 6), 16), 1] : undefined;
};

export function toHsl([r, g, b]: Rgba): [number, number, number] {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h / 6, s, l];
}

export function fromHsl(h: number, s: number, l: number, a: number): Rgba {
  const hue = (p: number, q: number, t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    return u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
  };
  if (s === 0) return [l * 255, l * 255, l * 255, a];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255, a];
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Applies the child elements of a color (`<a:lumMod val="75000"/>`…) in order. */
function transform(color: Rgba, steps: Xml[]): Rgba {
  let [r, g, b, a] = color;
  for (const step of steps) {
    const value = Number(step.attrs.val) / 100000;
    if (!Number.isFinite(value)) continue;
    if (step.name === "a:alpha") a = clamp(value);
    else if (step.name === "a:tint") [r, g, b] = [r, g, b].map((c) => c * value + 255 * (1 - value)) as [number, number, number];
    else if (step.name === "a:shade") [r, g, b] = [r, g, b].map((c) => c * value) as [number, number, number];
    else if (["a:lumMod", "a:lumOff", "a:satMod", "a:satOff", "a:hueMod"].includes(step.name)) {
      const [h, s, l] = toHsl([r, g, b, a]);
      const next =
        step.name === "a:lumMod" ? [h, s, clamp(l * value)] : step.name === "a:lumOff" ? [h, s, clamp(l + value)] : step.name === "a:satMod" ? [h, clamp(s * value), l] : step.name === "a:satOff" ? [h, clamp(s + value), l] : [(h * value) % 1, s, l];
      [r, g, b] = fromHsl(next[0], next[1], next[2], a);
    }
  }
  return [Math.round(r), Math.round(g), Math.round(b), a];
}

export const css = ([r, g, b, a]: Rgba) => (a >= 1 ? `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}` : `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`);

/** The color held by a fill/line/run element (`<a:solidFill>`), or undefined. `ph` replaces `phClr`, the theme styles' placeholder color. */
export function colorIn(parent: Xml | undefined, colors: Colors, ph?: Rgba): Rgba | undefined {
  const node = parent?.kids.find((child) => /^a:(srgbClr|schemeClr|sysClr|prstClr|scrgbClr)$/.test(child.name));
  if (!node) return undefined;
  let base: Rgba | undefined;
  if (node.name === "a:srgbClr") base = hex(node.attrs.val);
  else if (node.name === "a:sysClr") base = hex(node.attrs.lastClr) ?? (node.attrs.val === "window" ? [255, 255, 255, 1] : [0, 0, 0, 1]);
  else if (node.name === "a:prstClr") base = hex(PRESET_COLORS[node.attrs.val] ?? "000000");
  else if (node.name === "a:scrgbClr") base = [Number(node.attrs.r), Number(node.attrs.g), Number(node.attrs.b)].map((c) => Math.round((c / 100000) * 255)).concat(1) as Rgba;
  else if (node.attrs.val === "phClr") base = ph;
  else base = hex(colors.theme.colors[colors.map[node.attrs.val] ?? DEFAULT_MAP[node.attrs.val] ?? node.attrs.val]);
  return base ? transform(base, node.kids) : undefined;
}

export function parseTheme(xml: Xml | undefined): Theme {
  const scheme = xml?.kids.find((child) => child.name === "a:themeElements");
  const colors: Record<string, string> = {};
  for (const entry of kid(scheme, "a:clrScheme")?.kids ?? []) {
    const node = entry.kids[0];
    colors[entry.name.slice(2)] = node?.attrs.lastClr ?? node?.attrs.val ?? "000000";
  }
  const fonts = kid(scheme, "a:fontScheme");
  const style = kid(scheme, "a:fmtScheme");
  return {
    colors,
    major: kid(kid(fonts, "a:majorFont"), "a:latin")?.attrs.typeface ?? "Calibri",
    minor: kid(kid(fonts, "a:minorFont"), "a:latin")?.attrs.typeface ?? "Calibri",
    fills: kid(style, "a:fillStyleLst")?.kids ?? [],
    lines: kid(style, "a:lnStyleLst")?.kids ?? [],
    backgrounds: kid(style, "a:bgFillStyleLst")?.kids ?? [],
  };
}

/** Looks a typeface up in the theme (`+mj-lt` is the heading font, `+mn-lt` the body font). */
export const typeface = (name: string | undefined, theme: Theme) => (name === "+mj-lt" ? theme.major : name === "+mn-lt" ? theme.minor : name);

/** The fill held by `<a:spPr>`, `<a:bgPr>` or `<a:tcPr>`: undefined when it states none. `image` turns a relationship id into a picture URL. */
export function fillIn(parent: Xml | undefined, colors: Colors, image: (id: string) => string | undefined, ph?: Rgba): Fill | undefined {
  const node = parent?.kids.find((child) => ["a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:noFill"].includes(child.name));
  if (!node) return undefined;
  if (node.name === "a:noFill") return { kind: "none" };
  if (node.name === "a:solidFill") {
    const color = colorIn(node, colors, ph);
    return color ? { kind: "solid", color: css(color) } : undefined;
  }
  if (node.name === "a:pattFill") {
    const color = colorIn(kid(node, "a:fgClr"), colors, ph);
    return color ? { kind: "solid", color: css(color) } : undefined;
  }
  if (node.name === "a:blipFill") {
    const url = image(kid(node, "a:blip")?.attrs["r:embed"] ?? "");
    return url ? { kind: "image", url } : undefined;
  }
  const stops = kids(kid(node, "a:gsLst"), "a:gs").flatMap((stop) => {
    const color = colorIn(stop, colors, ph);
    return color ? [{ pos: Number(stop.attrs.pos) / 1000, color: css(color) }] : [];
  });
  if (stops.length === 0) return undefined;
  if (stops.length === 1) return { kind: "solid", color: stops[0].color };
  return { kind: "grad", angle: (Number(kid(node, "a:lin")?.attrs.ang) || 0) / 60000, radial: !!kid(node, "a:path"), stops };
}

const DASHES: Record<string, number[]> = { dash: [4, 3], sysDash: [3, 1], dot: [1, 3], sysDot: [1, 1], dashDot: [4, 3, 1, 3], lgDash: [8, 3], lgDashDot: [8, 3, 1, 3], sysDashDot: [3, 1, 1, 1] };

/** Merges `<a:ln>` elements, lowest priority first (the theme's line style, then the shape's own); null when the result is "no line". */
export function lineIn(lines: (Xml | undefined)[], colors: Colors, ph?: Rgba): Line | null {
  let width: number | undefined;
  let color: string | undefined;
  let none = false;
  let dash: number[] = [];
  let head = false;
  let tail = false;
  for (const ln of lines) {
    if (!ln) continue;
    if (ln.attrs.w !== undefined) width = Number(ln.attrs.w) / 9525;
    const fill = ln.kids.find((child) => ["a:solidFill", "a:noFill", "a:gradFill", "a:pattFill"].includes(child.name));
    if (fill?.name === "a:noFill") none = true;
    else if (fill) {
      none = false;
      const stop = fill.name === "a:solidFill" ? fill : kid(kid(fill, "a:gsLst"), "a:gs");
      const resolved = colorIn(stop, colors, ph);
      if (resolved) color = css(resolved);
    }
    const preset = kid(ln, "a:prstDash")?.attrs.val;
    if (preset) dash = DASHES[preset] ?? [];
    const headEnd = kid(ln, "a:headEnd")?.attrs.type;
    const tailEnd = kid(ln, "a:tailEnd")?.attrs.type;
    if (headEnd) head = headEnd !== "none";
    if (tailEnd) tail = tailEnd !== "none";
  }
  if (none || color === undefined) return null;
  return { width: width ?? 0.75, color, dash, head, tail };
}
