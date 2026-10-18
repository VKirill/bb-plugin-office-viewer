// Document colour tokens, text styles, DESIGN.md import, fidelity, command search.
import {
  newElementId,
  type ElementType,
  type Wireframe,
  type WireframeColorToken,
  type WireframeElement,
  type WireframeStyleLibrary,
  type WireframeTextStyle,
} from "./model.ts";

export type ProtoFidelity = "sketch" | "mockup";
export type ColorToken = WireframeColorToken;
export type TextStyle = WireframeTextStyle;
export type { WireframeStyleLibrary };

export type DesignImport = {
  colors: ColorToken[];
  text: TextStyle[];
};

export type CommandPaletteItem = {
  id: string;
  group: "action" | "element" | "page" | "component" | "template" | "icon";
  label: string;
  detail?: string;
  keywords?: string;
  shortcut?: string;
};

export function emptyStyleLibrary(): WireframeStyleLibrary {
  return { colors: [], text: [] };
}

export function newColorToken(name: string, value: string): ColorToken {
  return { id: newElementId(), name, value };
}

export function newTextStyle(name: string, partial?: Partial<Omit<TextStyle, "id" | "name">>): TextStyle {
  return {
    id: newElementId(),
    name,
    fontFamily: partial?.fontFamily ?? "system-ui, sans-serif",
    fontSize: partial?.fontSize ?? 16,
    fontWeight: partial?.fontWeight ?? 400,
    lineHeight: partial?.lineHeight ?? 1.4,
    color: partial?.color,
  };
}

export function getStyleLibrary(doc: Wireframe): WireframeStyleLibrary {
  return doc.styleLibrary ?? emptyStyleLibrary();
}

export function setStyleLibrary(doc: Wireframe, library: WireframeStyleLibrary): Wireframe {
  return { ...doc, styleLibrary: library };
}

export function findColorToken(library: WireframeStyleLibrary, id: string | undefined): ColorToken | null {
  if (!id) return null;
  return library.colors.find((item) => item.id === id) ?? null;
}

export function findTextStyle(library: WireframeStyleLibrary, id: string | undefined): TextStyle | null {
  if (!id) return null;
  return library.text.find((item) => item.id === id) ?? null;
}

export type LinkedStylePatch = {
  fill?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string | number;
};

export function linkedStylePatch(el: WireframeElement, library: WireframeStyleLibrary): LinkedStylePatch {
  const patch: LinkedStylePatch = {};
  const color = findColorToken(library, el.linkedColorTokenId);
  if (color) {
    patch.fill = color.value;
    patch.color = color.value;
  }
  const text = findTextStyle(library, el.linkedTextStyleId);
  if (text) {
    patch.fontSize = text.fontSize;
    patch.fontWeight = text.fontWeight;
    if (text.color) patch.color = text.color;
  }
  return patch;
}

export function resolveStylePatchWithLibrary(
  el: WireframeElement,
  basePatch: LinkedStylePatch,
  library: WireframeStyleLibrary | undefined,
): LinkedStylePatch {
  if (!library) return basePatch;
  const linked = linkedStylePatch(el, library);
  return { ...linked, ...basePatch };
}

export function applyColorTokenLink(el: WireframeElement, tokenId: string): WireframeElement {
  return { ...el, linkedColorTokenId: tokenId };
}

export function applyTextStyleLink(el: WireframeElement, styleId: string): WireframeElement {
  return { ...el, linkedTextStyleId: styleId };
}

export function unlinkElementStyles(el: WireframeElement): WireframeElement {
  const { linkedColorTokenId: _c, linkedTextStyleId: _t, ...rest } = el;
  return rest;
}

export function updateColorTokenInLibrary(library: WireframeStyleLibrary, tokenId: string, patch: Partial<ColorToken>): WireframeStyleLibrary {
  return {
    ...library,
    colors: library.colors.map((item) => (item.id === tokenId ? { ...item, ...patch } : item)),
  };
}

export function updateTextStyleInLibrary(library: WireframeStyleLibrary, styleId: string, patch: Partial<TextStyle>): WireframeStyleLibrary {
  return {
    ...library,
    text: library.text.map((item) => (item.id === styleId ? { ...item, ...patch } : item)),
  };
}

export function mergeDesignImport(library: WireframeStyleLibrary, imported: DesignImport): WireframeStyleLibrary {
  const colors = [...library.colors];
  const text = [...library.text];
  for (const token of imported.colors) {
    const existing = colors.find((item) => item.name.toLowerCase() === token.name.toLowerCase());
    if (existing) colors[colors.indexOf(existing)] = { ...existing, value: token.value };
    else colors.push(token);
  }
  for (const style of imported.text) {
    const existing = text.find((item) => item.name.toLowerCase() === style.name.toLowerCase());
    if (existing) text[text.indexOf(existing)] = { ...existing, ...style, id: existing.id };
    else text.push(style);
  }
  return { colors, text };
}

const HEX = /#(?:[0-9a-fA-F]{3,8})\b/g;
const CSS_VAR = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/gi;
const NAMED_COLOR_LINE = /^([a-zA-Z][\w-]*)\s*[:=]\s*(#[0-9a-fA-F]{3,8})\s*$/;
const TYPE_LINE = /^(h[1-6]|body|caption|label)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:px)?(?:\s*\/\s*(\d+(?:\.\d+)?))?/i;

export function parseDesignMarkdown(markdown: string): DesignImport {
  const colors: ColorToken[] = [];
  const text: TextStyle[] = [];
  const seenColor = new Set<string>();
  const seenText = new Set<string>();

  for (const match of markdown.matchAll(CSS_VAR)) {
    const name = match[1]!;
    const value = match[2]!;
    if (seenColor.has(name)) continue;
    seenColor.add(name);
    colors.push(newColorToken(name, value));
  }

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    const named = trimmed.match(NAMED_COLOR_LINE);
    if (named && !seenColor.has(named[1]!)) {
      seenColor.add(named[1]!);
      colors.push(newColorToken(named[1]!, named[2]!));
    }
    const type = trimmed.match(TYPE_LINE);
    if (type && !seenText.has(type[1]!.toLowerCase())) {
      seenText.add(type[1]!.toLowerCase());
      text.push(
        newTextStyle(type[1]!, {
          fontSize: Number(type[2]),
          lineHeight: type[3] ? Number(type[3]) : 1.4,
          fontWeight: type[1]!.toLowerCase().startsWith("h") ? 600 : 400,
        }),
      );
    }
    for (const hex of trimmed.match(HEX) ?? []) {
      const name = `color-${colors.length + 1}`;
      if (seenColor.has(name)) continue;
      if (colors.some((item) => item.value.toLowerCase() === hex.toLowerCase())) continue;
      seenColor.add(name);
      colors.push(newColorToken(name, hex));
    }
  }

  return { colors, text };
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function scoreItem(query: string, item: CommandPaletteItem): number {
  if (!query) return 1;
  const label = item.label.toLowerCase();
  const detail = item.detail?.toLowerCase() ?? "";
  const keywords = item.keywords?.toLowerCase() ?? "";
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (label.includes(query)) return 60;
  if (keywords.includes(query) || detail.includes(query)) return 40;
  if (query.length > 2 && label.split(/\s+/).some((word) => word.startsWith(query))) return 30;
  return 0;
}

export function rankCommandPaletteItems(query: string, items: readonly CommandPaletteItem[]): CommandPaletteItem[] {
  const q = normalizeQuery(query);
  return items
    .map((item) => ({ item, score: scoreItem(q, item) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .map((row) => row.item);
}

export function filterOutlineElements(
  elements: readonly WireframeElement[],
  query: string,
  typeFilter: ElementType | "all",
): WireframeElement[] {
  const q = normalizeQuery(query);
  return elements.filter((el) => {
    if (typeFilter !== "all" && el.type !== typeFilter) return false;
    if (!q) return true;
    const hay = `${el.label} ${el.type}`.toLowerCase();
    return hay.includes(q);
  });
}

export function fidelityBoardClassName(fidelity: ProtoFidelity): string {
  return fidelity === "sketch" ? "proto-fidelity-sketch" : "proto-fidelity-mockup";
}

export function fidelityExportClassName(fidelity: ProtoFidelity): string {
  return fidelity === "sketch" ? "grayscale contrast-90" : "";
}

export function sketchElementStyleOverrides(fidelity: ProtoFidelity): Record<string, string | number> {
  if (fidelity !== "sketch") return {};
  return {
    filter: "grayscale(1)",
    fontFamily: "Comic Sans MS, cursive, system-ui",
    borderStyle: "dashed",
  };
}
