import type { WireframeCanvas, WireframeElement } from "./model.ts";

export type Rgba = { r: number; g: number; b: number; a: number };

export const CHECKERBOARD_BG =
  "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 10px 10px";

export const HUE_SLIDER_BG =
  "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";

export const PROTOTYPE_STYLE_COLOUR_FALLBACK = {
  text: "#000000",
  fill: "#ffffff",
  stroke: "#333333",
  canvas: "#ffffff",
} as const;

export const INSPECTOR_COLOUR_PRESETS = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#64748b",
  "transparent",
] as const;

export function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function parseColour(input: string): Rgba | null {
  const raw = input.trim();
  if (!raw || raw === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (raw.startsWith("#")) {
    const hex = raw.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
    return null;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(raw);
  if (!rgb) return null;
  return {
    r: clampChannel(Number(rgb[1])),
    g: clampChannel(Number(rgb[2])),
    b: clampChannel(Number(rgb[3])),
    a: rgb[4] === undefined ? 1 : clampAlpha(Number(rgb[4])),
  };
}

export function formatHex(rgba: Rgba, withAlpha = false): string {
  if (rgba.a <= 0) return "transparent";
  const r = clampChannel(rgba.r).toString(16).padStart(2, "0");
  const g = clampChannel(rgba.g).toString(16).padStart(2, "0");
  const b = clampChannel(rgba.b).toString(16).padStart(2, "0");
  if (!withAlpha || rgba.a >= 1) return `#${r}${g}${b}`.toUpperCase();
  const a = Math.round(clampAlpha(rgba.a) * 255).toString(16).padStart(2, "0");
  return `#${r}${g}${b}${a}`.toUpperCase();
}

export function rgbaToCss(rgba: Rgba): string {
  if (rgba.a <= 0) return "transparent";
  if (rgba.a >= 1) return formatHex(rgba);
  return `rgba(${clampChannel(rgba.r)}, ${clampChannel(rgba.g)}, ${clampChannel(rgba.b)}, ${clampAlpha(rgba.a)})`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgba = parseColour(hex) ?? { r: 0, g: 0, b: 0, a: 1 };
  const r = rgba.r / 255;
  const g = rgba.g / 255;
  const b = rgba.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h / 6) * 360, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(1, Math.max(0, s));
  const lig = Math.min(1, Math.max(0, l));
  if (sat === 0) {
    const v = clampChannel(lig * 255);
    return formatHex({ r: v, g: v, b: v, a: 1 });
  }
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
  const p = 2 * lig - q;
  const hk = hue / 360;
  const tc = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return formatHex({
    r: clampChannel(tc(hk + 1 / 3) * 255),
    g: clampChannel(tc(hk) * 255),
    b: clampChannel(tc(hk - 1 / 3) * 255),
    a: 1,
  });
}

export function normalizeColourInput(value: string): string {
  const parsed = parseColour(value);
  if (!parsed) return value;
  return rgbaToCss(parsed);
}

export function colourIsNone(value: string | undefined): boolean {
  if (!value) return false;
  if (value.trim() === "transparent") return true;
  const parsed = parseColour(value);
  return parsed !== null && parsed.a <= 0;
}

/** Value shown in the field: explicit colour, else fallback (not written until the user edits). */
export function resolvePickerColour(value: string | undefined, fallback: string): Rgba {
  const source = value === undefined || value === "" ? fallback : value;
  return parseColour(source) ?? parseColour(fallback) ?? { r: 0, g: 0, b: 0, a: 1 };
}

export function formatRgbChannels(rgba: Rgba): string {
  return `${clampChannel(rgba.r)}, ${clampChannel(rgba.g)}, ${clampChannel(rgba.b)}`;
}

export function parseRgbChannels(input: string, alpha = 1): Rgba | null {
  const parts = input.split(",").map((part) => part.trim());
  if (parts.length !== 3) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b), a: clampAlpha(alpha) };
}

export function withAlpha(rgba: Rgba, alpha: number): string {
  return rgbaToCss({ ...rgba, a: clampAlpha(alpha) });
}

export function collectDocumentColours(canvas: WireframeCanvas, elements: readonly WireframeElement[]): string[] {
  const seen = new Set<string>();
  const add = (raw?: string) => {
    if (!raw) return;
    const parsed = parseColour(raw);
    if (!parsed || parsed.a <= 0) return;
    seen.add(formatHex(parsed, parsed.a < 1));
  };
  add(canvas.background);
  for (const el of elements) {
    add(el.style?.base?.fill);
    add(el.style?.base?.color);
    add(el.style?.base?.stroke);
  }
  return [...seen].slice(0, 14);
}
