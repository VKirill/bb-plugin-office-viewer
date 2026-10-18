// Inspector helpers: element.style, effects, lists, tables, radio groups.
import type { I18nKey } from "../../shared/i18n.ts";
import { checkRadio, type ItemKey } from "./editing.ts";
import type { ElementStyle, ElementType, PropValue, WireframeElement, WireframeStyleLibrary } from "./model.ts";
import { linkedStylePatch } from "./styles.ts";

export const STYLE_EFFECTS = ["hover", "pressed", "selected", "disabled", "focus"] as const;
export type StyleEffect = (typeof STYLE_EFFECTS)[number];
export type StyleTarget = "base" | StyleEffect;

export type StylePatch = {
  fill?: string;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  opacity?: number;
  fontSize?: number;
  fontWeight?: string | number;
  textAlign?: "left" | "center" | "right";
  shadow?: boolean;
};

export type WireframeStyle = ElementStyle;

export type StyleFieldKind = "text" | "number" | "boolean" | "select";

export type StyleFieldDef = {
  key: keyof StylePatch;
  kind: StyleFieldKind;
  label: I18nKey;
  options?: string[];
};

/** Axure-style style tab field order. */
export const STYLE_TAB_FIELDS: readonly StyleFieldDef[] = [
  { key: "fill", kind: "text", label: "protoPropFill" },
  { key: "color", kind: "text", label: "protoPropColor" },
  { key: "stroke", kind: "text", label: "protoPropStroke" },
  { key: "strokeWidth", kind: "number", label: "protoPropStrokeWidth" },
  { key: "radius", kind: "number", label: "protoPropRadius" },
  { key: "fontSize", kind: "number", label: "protoPropFontSize" },
  { key: "fontWeight", kind: "text", label: "protoPropFontWeight" },
  { key: "textAlign", kind: "select", label: "protoPropTextAlign", options: ["left", "center", "right"] },
  { key: "opacity", kind: "number", label: "protoPropOpacity" },
  { key: "shadow", kind: "boolean", label: "protoPropShadow" },
];

export const LIST_EDITOR_TYPES: readonly ElementType[] = [
  "ChoicePicker",
  "ListBox",
  "List",
  "Nav",
  "Tabs",
  "Menu",
  "Breadcrumbs",
  "Tree",
  "DynamicPanel",
];

const LIST_PROP: Partial<Record<ElementType, ItemKey | "items">> = {
  ChoicePicker: "options",
  ListBox: "items",
  List: "items",
  Nav: "items",
  Tabs: "items",
  Menu: "items",
  Breadcrumbs: "items",
  Tree: "items",
  DynamicPanel: "states",
};

export type MixedValue<T> = T | "mixed" | undefined;

export function readStyle(el: WireframeElement): WireframeStyle {
  return el.style ?? {};
}

export function resolveStylePatch(el: WireframeElement, target: StyleTarget, library?: WireframeStyleLibrary): StylePatch {
  const style = readStyle(el);
  const base = style.base ?? {};
  const merged = target === "base" ? { ...base } : { ...base, ...(style.effects?.[target] ?? {}) };
  if (target !== "base" || !library) return merged;
  return { ...linkedStylePatch(el, library), ...merged };
}

export function mergeStylePatch(el: WireframeElement, target: StyleTarget, patch: Partial<StylePatch>): WireframeElement {
  const style = readStyle(el);
  if (target === "base") {
    return { ...el, style: { ...style, base: { ...(style.base ?? {}), ...patch } } };
  }
  const effects = { ...(style.effects ?? {}) };
  effects[target] = { ...(effects[target] ?? {}), ...patch };
  return { ...el, style: { ...style, effects } };
}

export function mixedStyleValue<T extends string | number | boolean>(
  elements: readonly WireframeElement[],
  target: StyleTarget,
  key: keyof StylePatch,
): MixedValue<T> {
  if (!elements.length) return undefined;
  const values = elements.map((el) => resolveStylePatch(el, target)[key]);
  const first = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== first) return "mixed";
  }
  return first as T | undefined;
}

export function applyStyleToElements(
  elements: readonly WireframeElement[],
  ids: ReadonlySet<string>,
  target: StyleTarget,
  patch: Partial<StylePatch>,
): WireframeElement[] {
  return elements.map((el) => (ids.has(el.id) ? mergeStylePatch(el, target, patch) : el));
}

export function stylePatchToInline(patch: StylePatch): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (patch.fill) out.background = patch.fill;
  if (patch.color) out.color = patch.color;
  if (patch.stroke) out.borderColor = patch.stroke;
  if (typeof patch.strokeWidth === "number") {
    out.borderWidth = patch.strokeWidth;
    if (patch.strokeWidth > 0) out.borderStyle = "solid";
  }
  if (typeof patch.radius === "number") out.borderRadius = patch.radius;
  if (typeof patch.opacity === "number") out.opacity = patch.opacity;
  if (typeof patch.fontSize === "number") out.fontSize = patch.fontSize;
  if (patch.fontWeight !== undefined) out.fontWeight = patch.fontWeight;
  if (patch.textAlign) out.textAlign = patch.textAlign;
  if (patch.shadow) out.boxShadow = "0 2px 8px color-mix(in oklab, var(--foreground) 25%, transparent)";
  return out;
}

/** Canvas / export / slides: element.style (+ padding prop) as CSS for the element box. */
export function wireframeElementBoxStyle(
  el: WireframeElement,
  target: StyleTarget = "base",
  library?: WireframeStyleLibrary,
): Record<string, string | number> {
  const inline = stylePatchToInline(resolveStylePatch(el, target, library));
  const padding = typeof el.props.padding === "number" ? el.props.padding : undefined;
  if (padding !== undefined) {
    inline.padding = padding;
    inline.boxSizing = "border-box";
  }
  return inline;
}

/** Inner face overrides from style (no opacity — applied on the element box). */
export function elementFaceStyleOverrides(
  el: WireframeElement,
  target: StyleTarget = "base",
  library?: WireframeStyleLibrary,
): Record<string, string | number> {
  const patch = resolveStylePatch(el, target, library);
  const out: Record<string, string | number> = {};
  if (patch.fill) out.background = patch.fill;
  if (patch.color) out.color = patch.color;
  if (patch.stroke) out.borderColor = patch.stroke;
  if (typeof patch.strokeWidth === "number") {
    out.borderWidth = patch.strokeWidth;
    if (patch.strokeWidth > 0) out.borderStyle = "solid";
  }
  if (typeof patch.radius === "number") out.borderRadius = patch.radius;
  if (typeof patch.fontSize === "number") out.fontSize = patch.fontSize;
  if (patch.fontWeight !== undefined) out.fontWeight = patch.fontWeight;
  if (patch.textAlign) out.textAlign = patch.textAlign;
  if (patch.shadow) out.boxShadow = "0 2px 8px color-mix(in oklab, var(--foreground) 25%, transparent)";
  return out;
}

export function listPropKey(type: ElementType): ItemKey | null {
  const key = LIST_PROP[type];
  return key ?? null;
}

export function readStringList(el: WireframeElement, key: string): string[] {
  const value = el.props[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

export function writeStringList(el: WireframeElement, key: string, items: string[]): WireframeElement {
  return { ...el, props: { ...el.props, [key]: items } };
}

export function radioGroupOptions(elements: readonly WireframeElement[]): { id: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const el of elements) {
    if (el.type !== "Radio") continue;
    const group = typeof el.props.group === "string" ? el.props.group : "";
    if (group && !seen.has(group)) seen.set(group, group);
  }
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}

export function assignRadioGroup(elements: readonly WireframeElement[], radioId: string, groupId: string | null): WireframeElement[] {
  return elements.map((el) => {
    if (el.id !== radioId) return el;
    const props = { ...el.props };
    if (!groupId) delete props.group;
    else props.group = groupId;
    return { ...el, props };
  });
}

export function createRadioGroup(elements: readonly WireframeElement[], radioIds: readonly string[]): WireframeElement[] {
  if (!radioIds.length) return [...elements];
  const groupId = `radio_${Date.now().toString(36)}`;
  const pick = new Set(radioIds);
  return elements.map((el) => (pick.has(el.id) && el.type === "Radio" ? { ...el, props: { ...el.props, group: groupId } } : el));
}

export function setRadioChecked(elements: readonly WireframeElement[], radioId: string, checked: boolean): WireframeElement[] {
  if (!checked) {
    return elements.map((el) => (el.id === radioId ? { ...el, props: { ...el.props, checked: false } } : el));
  }
  return checkRadio(elements, radioId);
}

export type TableModel = {
  columns: number;
  rows: number;
  headers: string[];
  cells: string[][];
};

function clampTable(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function readTable(el: WireframeElement): TableModel {
  const columns = clampTable(typeof el.props.columns === "number" ? el.props.columns : 3, 1, 12);
  const rows = clampTable(typeof el.props.rows === "number" ? el.props.rows : 3, 1, 40);
  const headersRaw = el.props.headers;
  const headers = Array.isArray(headersRaw) && headersRaw.every((item) => typeof item === "string") ? headersRaw : [];
  const filledHeaders = Array.from({ length: columns }, (_, i) => headers[i] ?? `Col ${i + 1}`);
  const rawCells = el.props.cells;
  const cells: string[][] = [];
  if (isCellMatrix(rawCells)) {
    for (let r = 0; r < rows; r++) {
      const row = rawCells[r] ?? [];
      cells.push(Array.from({ length: columns }, (_, c) => (typeof row[c] === "string" ? row[c] : `${r + 1},${c + 1}`)));
    }
  } else {
    for (let r = 0; r < rows; r++) {
      cells.push(Array.from({ length: columns }, (_, c) => `${r + 1},${c + 1}`));
    }
  }
  return { columns, rows, headers: filledHeaders, cells };
}

export function writeTable(el: WireframeElement, model: TableModel): WireframeElement {
  return {
    ...el,
    props: {
      ...el.props,
      columns: model.columns,
      rows: model.rows,
      headers: model.headers,
      cells: model.cells,
    },
  };
}

export function setTableCell(model: TableModel, row: number, col: number, value: string): TableModel {
  const cells = model.cells.map((r) => [...r]);
  if (!cells[row]) return model;
  cells[row][col] = value;
  return { ...model, cells };
}

export function insertTableRow(model: TableModel, at: number): TableModel {
  const row = Array.from({ length: model.columns }, (_, c) => `${at + 1},${c + 1}`);
  const cells = [...model.cells];
  cells.splice(at, 0, row);
  return { ...model, rows: model.rows + 1, cells };
}

export function deleteTableRow(model: TableModel, at: number): TableModel {
  if (model.rows <= 1) return model;
  const cells = model.cells.filter((_, i) => i !== at);
  return { ...model, rows: model.rows - 1, cells };
}

export function insertTableColumn(model: TableModel, at: number): TableModel {
  const headers = [...model.headers];
  headers.splice(at, 0, `Col ${at + 1}`);
  const cells = model.cells.map((row, r) => {
    const next = [...row];
    next.splice(at, 0, `${r + 1},${at + 1}`);
    return next;
  });
  return { ...model, columns: model.columns + 1, headers, cells };
}

export function deleteTableColumn(model: TableModel, at: number): TableModel {
  if (model.columns <= 1) return model;
  const headers = model.headers.filter((_, i) => i !== at);
  const cells = model.cells.map((row) => row.filter((_, i) => i !== at));
  return { ...model, columns: model.columns - 1, headers, cells };
}

export function parseTableTsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("\t"));
}

export function pasteTableTsv(model: TableModel, tsv: string, startRow: number, startCol: number): TableModel {
  const pasted = parseTableTsv(tsv);
  if (!pasted.length) return model;
  let columns = model.columns;
  let rows = model.rows;
  let cells = model.cells.map((r) => [...r]);
  for (let r = 0; r < pasted.length; r++) {
    const targetRow = startRow + r;
    while (targetRow >= rows) {
      cells.push(Array.from({ length: columns }, (_, c) => `${rows + 1},${c + 1}`));
      rows += 1;
    }
    for (let c = 0; c < pasted[r]!.length; c++) {
      const targetCol = startCol + c;
      while (targetCol >= columns) {
        cells = cells.map((row, ri) => [...row, `${ri + 1},${columns + 1}`]);
        columns += 1;
      }
      cells[targetRow]![targetCol] = pasted[r]![c] ?? "";
    }
  }
  const headers = Array.from({ length: columns }, (_, i) => model.headers[i] ?? `Col ${i + 1}`);
  return { columns, rows, headers, cells };
}

function isCellMatrix(value: PropValue | undefined): value is string[][] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"));
}

export function tableCellNav(
  row: number,
  col: number,
  columns: number,
  rows: number,
  key: "Enter" | "Tab",
  shift: boolean,
): { row: number; col: number } {
  if (key === "Tab") {
    if (shift) {
      if (col > 0) return { row, col: col - 1 };
      if (row > 0) return { row: row - 1, col: columns - 1 };
      return { row, col };
    }
    if (col < columns - 1) return { row, col: col + 1 };
    if (row < rows - 1) return { row: row + 1, col: 0 };
    return { row, col };
  }
  if (row < rows - 1) return { row: row + 1, col };
  return { row, col };
}
