// Hugeicons name helpers for search and display (no React / no package import).

export const ICON_DRAG_PREFIX = "proto-icon:";

export function iconSearchWords(name: string): string[] {
  const base = name.endsWith("Icon") ? name.slice(0, -4) : name;
  const spaced = base
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .replace(/([0-9])([a-z])/gi, "$1 $2");
  return spaced.toLowerCase().split(/\s+/).filter(Boolean);
}

export function iconDisplayLabel(name: string): string {
  return iconSearchWords(name).join(" ");
}

export function filterIcons(names: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...names];
  const terms = q.split(/\s+/).filter(Boolean);
  return names.filter((name) => {
    const haystack = `${iconSearchWords(name).join(" ")} ${name.toLowerCase()}`;
    return terms.every((term) => haystack.includes(term));
  });
}

export const PROTO_ICON_SIZES = [16, 20, 24, 32, 48] as const;
export type ProtoIconSize = (typeof PROTO_ICON_SIZES)[number];

export const PROTO_ICON_COLORS = ["foreground", "muted", "primary"] as const;
export type ProtoIconThemeColor = (typeof PROTO_ICON_COLORS)[number];

export function isProtoIconCustomColor(color: string): boolean {
  return color.startsWith("#");
}
