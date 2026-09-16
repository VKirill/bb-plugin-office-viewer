// Editing model shared by the grid and the save call: ranges, typed input,
// pending-edit display, formulas made stale by edits, and chat quotes.
import * as XLSX from "xlsx";
import { cellAddress, columnName, textCell, type Cell, type Sheet } from "./sheet.ts";
import type { CellEdit } from "./xlsx-patch.ts";

export type Position = { row: number; col: number };
export type Range = { r1: number; c1: number; r2: number; c2: number };
export type Edit = CellEdit extends infer E ? (E extends unknown ? Omit<E, "row" | "col"> : never) : never;

export const cellKey = (cols: number, row: number, col: number) => row * Math.max(cols, 1) + col;

export function toRange(anchor: Position, focus: Position): Range {
  return { r1: Math.min(anchor.row, focus.row), c1: Math.min(anchor.col, focus.col), r2: Math.max(anchor.row, focus.row), c2: Math.max(anchor.col, focus.col) };
}

export const inRange = (range: Range, row: number, col: number) => row >= range.r1 && row <= range.r2 && col >= range.c1 && col <= range.c2;

export function rangeLabel(range: Range): string {
  const from = cellAddress(range.r1, range.c1);
  return range.r1 === range.r2 && range.c1 === range.c2 ? from : `${from}:${cellAddress(range.r2, range.c2)}`;
}

const NUMBER_INPUT = /^[-+]?(\d[\d\s ]*)?([.,]\d+)?(e[-+]?\d+)?$/i;
const DATE_INPUT = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/;

/** Excel serial date (1900 system) for a day-first date. */
function serialDate(day: number, month: number, year: number, hours = 0, minutes = 0): number | null {
  const full = year < 100 ? 2000 + year : year;
  const time = Date.UTC(full, month - 1, day, hours, minutes);
  const check = new Date(time);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return (time - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** Interprets what the user typed the way Excel would, for the cell being edited. */
export function parseInput(input: string, cell: Cell | null, mode: "xlsx" | "csv"): Edit {
  if (input === "") return { kind: "clear" };
  if (mode === "csv") return { kind: "string", text: input };
  const text = input.trim();
  if (text.startsWith("=") && text.length > 1) return { kind: "formula", formula: text.slice(1) };
  if (/^(true|false|истина|ложь)$/i.test(text)) return { kind: "boolean", value: /^(true|истина)$/i.test(text) };
  const date = DATE_INPUT.exec(text);
  if (date && (cell?.isDate || !cell)) {
    const serial = serialDate(Number(date[1]), Number(date[2]), Number(date[3]), Number(date[4] ?? 0), Number(date[5] ?? 0));
    if (serial !== null) return { kind: "number", value: serial };
  }
  const percent = /%$/.test(text);
  const numeric = text.replace(/%$/, "");
  if (numeric !== "" && /\d/.test(numeric) && NUMBER_INPUT.test(numeric)) {
    const value = Number(numeric.replace(/[\s ]/g, "").replace(",", "."));
    if (Number.isFinite(value)) return { kind: "number", value: percent ? value / 100 : value };
  }
  return { kind: "string", text: input };
}

/** Text shown in the cell editor: the formula, the date as displayed, or the raw number. */
export function editorText(cell: Cell | null): string {
  if (!cell) return "";
  if (cell.formula) return cell.formula;
  if (typeof cell.value === "number" && !cell.isDate) return String(cell.value);
  return cell.text;
}

function formatNumber(value: number, format: string | null): string {
  if (!format || format === "General") return String(value);
  try {
    return XLSX.SSF.format(format, value);
  } catch {
    try {
      return XLSX.SSF.format(format.replace(/\./g, "/"), value).replace(/\//g, ".");
    } catch {
      return String(value);
    }
  }
}

/** How a cell looks with a pending edit applied, keeping its number format. */
export function displayEdit(edit: Edit, original: Cell | null): Cell | null {
  const format = original?.format ?? null;
  switch (edit.kind) {
    case "clear":
      return null;
    case "string":
      return { ...textCell(edit.text), numeric: false, format };
    case "boolean":
      return { ...textCell(edit.value ? "TRUE" : "FALSE"), numeric: false, format, value: edit.value };
    case "number":
      return { ...textCell(formatNumber(edit.value, format)), numeric: true, format, isDate: original?.isDate ?? false, value: edit.value };
    case "formula":
      return { ...textCell(""), formula: `=${edit.formula}`, format };
  }
}

export function toCellEdit(position: Position, edit: Edit): CellEdit {
  return { ...position, ...edit } as CellEdit;
}

type Ref = { sheet: string; range: Range };

const REF_RE =
  /(?:(?:'((?:[^']|'')+)'|([\p{L}\p{N}_.]+))!)?(?:\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?|\$?([A-Z]{1,3}):\$?([A-Z]{1,3})|\$?(\d+):\$?(\d+))(?![\p{L}\p{N}_(])/gu;

function colIndex(letters: string) {
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

/** Cell and range references in a formula; string literals are ignored. Over-matching only marks more cells stale. */
export function formulaRefs(formula: string, sheet: string): Ref[] {
  const code = formula.replace(/"(?:[^"]|"")*"/g, '""');
  const refs: Ref[] = [];
  for (const m of code.matchAll(REF_RE)) {
    const target = m[1]?.replace(/''/g, "'") ?? m[2] ?? sheet;
    if (m[3]) {
      const r1 = Number(m[4]) - 1;
      const c1 = colIndex(m[3]);
      const r2 = m[6] ? Number(m[6]) - 1 : r1;
      const c2 = m[5] ? colIndex(m[5]) : c1;
      refs.push({ sheet: target, range: { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) } });
    } else if (m[7]) {
      const a = colIndex(m[7]);
      const b = colIndex(m[8]);
      refs.push({ sheet: target, range: { r1: 0, c1: Math.min(a, b), r2: Number.MAX_SAFE_INTEGER, c2: Math.max(a, b) } });
    } else if (m[9]) {
      const a = Number(m[9]) - 1;
      const b = Number(m[10]) - 1;
      refs.push({ sheet: target, range: { r1: Math.min(a, b), c1: 0, r2: Math.max(a, b), c2: Number.MAX_SAFE_INTEGER } });
    }
  }
  return refs;
}

/**
 * Formula cells whose value depends, directly or through other formulas, on
 * the changed cells. Keys are `${sheetName}!${row}:${col}`.
 */
export function staleFormulas(sheets: Sheet[], changed: { sheet: string; row: number; col: number }[]): Set<string> {
  const formulas = sheets.flatMap((sheet) =>
    sheet.formulas.map((f) => ({ key: `${sheet.name}!${f.row}:${f.col}`, sheet: sheet.name, row: f.row, col: f.col, refs: formulaRefs(f.formula, sheet.name) })),
  );
  const stale = new Set<string>();
  let frontier = changed;
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const formula of formulas) {
      if (stale.has(formula.key)) continue;
      const hit = formula.refs.some((ref) => frontier.some((c) => c.sheet === ref.sheet && inRange(ref.range, c.row, c.col)));
      if (hit) {
        stale.add(formula.key);
        next.push(formula);
      }
    }
    frontier = next;
  }
  return stale;
}

const MAX_QUOTE_ROWS = 100;
const MAX_QUOTE_COLS = 30;

/** Selected cells as tab-separated text, like copying from Excel. */
export function rangeTsv(range: Range, cellAt: (row: number, col: number) => Cell | null): string {
  const lines: string[] = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const values: string[] = [];
    for (let c = range.c1; c <= range.c2; c++) {
      const text = cellAt(r, c)?.text ?? "";
      values.push(/[\t\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
    }
    lines.push(values.join("\t"));
  }
  return lines.join("\n");
}

/** A chat draft block: file, sheet and range, then the cells as a Markdown table. */
export function formatQuote(input: {
  path: string;
  host: string;
  sheet: string;
  range: Range;
  cellAt: (row: number, col: number) => Cell | null;
  comment?: string;
  more: (rows: number, cols: number) => string;
}): string {
  const { range } = input;
  const r2 = Math.min(range.r2, range.r1 + MAX_QUOTE_ROWS - 1);
  const c2 = Math.min(range.c2, range.c1 + MAX_QUOTE_COLS - 1);
  const escape = (text: string) => text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const header = ["", ...Array.from({ length: c2 - range.c1 + 1 }, (_, i) => columnName(range.c1 + i))];
  const lines = [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`];
  for (let r = range.r1; r <= r2; r++) {
    const values = [String(r + 1)];
    for (let c = range.c1; c <= c2; c++) {
      const cell = input.cellAt(r, c);
      const text = cell ? (cell.formula ? `${cell.text} \`${cell.formula}\``.trim() : cell.text) : "";
      values.push(escape(text));
    }
    lines.push(`| ${values.join(" | ")} |`);
  }
  const hiddenRows = range.r2 - r2;
  const hiddenCols = range.c2 - c2;
  const sheetRef = /^[\p{L}\p{N}_]+$/u.test(input.sheet) ? input.sheet : `'${input.sheet.replace(/'/g, "''")}'`;
  const parts = [`\`${input.path}\` · ${sheetRef}!${rangeLabel(range)} · ${input.host}`, "", ...lines];
  if (hiddenRows > 0 || hiddenCols > 0) parts.push("", input.more(hiddenRows, hiddenCols));
  if (input.comment?.trim()) parts.push("", input.comment.trim());
  return parts.join("\n");
}
