// Selection ranges, typed-input interpretation, copying and chat quotes.
import { cellAddress, columnName, type Cell } from "./sheet.ts";
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

/** Text shown in the cell editor: the formula or the value as entered. */
export function editorText(cell: Cell | null): string {
  if (!cell) return "";
  if (cell.formula) return cell.formula;
  return typeof cell.value === "string" ? cell.value.replace(/^'/, "") : cell.text;
}

/** Tab-separated text from the clipboard as rows of cells (quoted fields may contain tabs and line breaks). */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const body = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === "\t") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows;
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
