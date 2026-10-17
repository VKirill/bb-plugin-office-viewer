export type Rgba = { r: number; g: number; b: number; a: number };

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
