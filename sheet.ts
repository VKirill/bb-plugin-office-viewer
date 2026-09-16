// Spreadsheet model: parses workbook bytes with SheetJS into sheets the grid
// reads cell by cell. Pure and DOM-free so it runs under node tests.
import * as XLSX from "xlsx";
import { parseCsv } from "./csv.ts";

export const TEXT_EXTENSIONS = ["csv", "tsv"];
export const EXTENSIONS = ["xlsx", "xlsm", "xlsb", "xls", "ods", ...TEXT_EXTENSIONS];

/** How a file can be saved: surgical XML patch, text rewrite, or not at all. */
export function editMode(extension: string): "xlsx" | "csv" | null {
  if (extension === "xlsx" || extension === "xlsm") return "xlsx";
  return TEXT_EXTENSIONS.includes(extension) ? "csv" : null;
}

export type Cell = {
  text: string;
  numeric: boolean;
  formula: string | null;
  link: string | null;
  /** Number format code, e.g. `dd.mm.yyyy`. */
  format: string | null;
  isDate: boolean;
  /** Raw value: the number behind a formatted number or date. */
  value: string | number | boolean | null;
};

export type Merge = { r1: number; c1: number; r2: number; c2: number };

export type Sheet = {
  name: string;
  hidden: boolean;
  rows: number;
  cols: number;
  /** Column widths in px. */
  widths: number[];
  merges: Merge[];
  formulas: { row: number; col: number; formula: string }[];
  cell(row: number, col: number): Cell | null;
};

const MIN_WIDTH = 48;
const MAX_WIDTH = 320;
const CHAR_PX = 7.5;
const SAMPLE_ROWS = 500;
const URL_RE = /^https?:\/\/\S+$/i;
const NUMBER_RE = /^[-+]?(\d[\d\s ]*)?([.,]\d+)?%?$/;

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(col: number): string {
  let name = "";
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

export function cellAddress(row: number, col: number): string {
  return `${columnName(col)}${row + 1}`;
}

type RawCell = XLSX.CellObject & { w?: string; f?: string; z?: string | number; l?: { Target?: string } };

/**
 * SheetJS throws on dotted date formats such as `dd.mm.yyyy` (common in
 * Russian Excel) and leaves the raw serial number. Format with slashes and
 * put the dots back.
 */
function dottedDate(raw: RawCell): string | undefined {
  if (raw.t !== "n" || typeof raw.v !== "number" || typeof raw.z !== "string") return undefined;
  if (!raw.z.includes(".") || raw.z.includes("/") || !XLSX.SSF.is_date(raw.z)) return undefined;
  try {
    return XLSX.SSF.format(raw.z.replace(/\./g, "/"), raw.v).replace(/\//g, ".");
  } catch {
    return undefined;
  }
}

function toCell(raw: RawCell | undefined): Cell | null {
  if (!raw || (raw.t === "z" && !raw.f)) return null;
  const text = raw.w ?? dottedDate(raw) ?? (raw.v == null ? "" : String(raw.v));
  const format = typeof raw.z === "string" ? raw.z : null;
  return {
    ...textCell(text),
    numeric: raw.t === "n" || (raw.t === "s" && isNumberText(text)),
    formula: raw.f ? `=${raw.f}` : null,
    link: linkOf(raw.l?.Target ?? text.trim()),
    format,
    isDate: raw.t === "n" && format !== null && XLSX.SSF.is_date(format),
    value: raw.v instanceof Date ? raw.v.toISOString() : (raw.v ?? null),
  };
}

const isNumberText = (text: string) => text.trim() !== "" && NUMBER_RE.test(text.trim());
const linkOf = (target: string) => (URL_RE.test(target) ? target : null);

export function textCell(text: string): Cell {
  return { text, numeric: isNumberText(text), formula: null, link: linkOf(text.trim()), format: null, isDate: false, value: text };
}

function widthsFor(cols: number, rows: number, textAt: (row: number, col: number) => string | undefined, declared: XLSX.ColInfo[] = []) {
  const chars = new Array<number>(cols).fill(0);
  for (let r = 0; r < Math.min(rows, SAMPLE_ROWS); r++) {
    for (let c = 0; c < cols; c++) {
      const text = textAt(r, c);
      if (!text) continue;
      const longest = Math.max(...text.split("\n").map((line) => line.length));
      if (longest > chars[c]) chars[c] = longest;
    }
  }
  return chars.map((count, c) => {
    const excel = declared[c]?.wpx ?? (declared[c]?.wch ? declared[c].wch * CHAR_PX : undefined);
    const px = excel ?? count * CHAR_PX + 16;
    return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, px)));
  });
}

function buildSheet(name: string, hidden: boolean, ws: XLSX.WorkSheet): Sheet {
  const data = ((ws as { "!data"?: RawCell[][] })["!data"] ?? []) as (RawCell[] | undefined)[];
  const merges: Merge[] = (ws["!merges"] ?? []).map((m) => ({ r1: m.s.r, c1: m.s.c, r2: m.e.r, c2: m.e.c }));
  let rows = data.length;
  let cols = 0;
  for (const row of data) if (row && row.length > cols) cols = row.length;
  for (const m of merges) {
    rows = Math.max(rows, m.r2 + 1);
    cols = Math.max(cols, m.c2 + 1);
  }

  const widths = widthsFor(cols, rows, (r, c) => {
    const cell = data[r]?.[c];
    return cell ? (cell.w ?? (cell.v == null ? "" : String(cell.v))) : undefined;
  }, ws["!cols"]);
  const formulas: Sheet["formulas"] = [];
  data.forEach((row, r) => row?.forEach((cell, c) => {
    if (cell?.f) formulas.push({ row: r, col: c, formula: cell.f });
  }));

  return {
    name,
    hidden,
    rows,
    cols,
    widths,
    merges,
    formulas,
    cell: (row, col) => toCell(data[row]?.[col]),
  };
}

export function parseWorkbook(bytes: Uint8Array, extension: string): Sheet[] {
  if (TEXT_EXTENSIONS.includes(extension)) {
    const { rows: data } = parseCsv(bytes, extension);
    const cols = Math.max(0, ...data.map((row) => row.length));
    return [{
      name: extension.toUpperCase(),
      hidden: false,
      rows: data.length,
      cols,
      widths: widthsFor(cols, data.length, (r, c) => data[r]?.[c]),
      merges: [],
      formulas: [],
      cell: (row, col) => {
        const text = data[row]?.[col];
        return text === undefined || text === "" ? null : textCell(text);
      },
    }];
  }
  const book = XLSX.read(bytes, { type: "array", dense: true, cellNF: true, cellStyles: false, sheetStubs: true });
  const meta = book.Workbook?.Sheets ?? [];
  return book.SheetNames.map((name, index) => buildSheet(name, Boolean(meta[index]?.Hidden), book.Sheets[name]));
}

/** Cells whose text contains `query`, case-insensitive, in reading order. */
export function findCells(sheet: Sheet, query: string, limit = 10_000): { row: number; col: number }[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") return [];
  const found: { row: number; col: number }[] = [];
  for (let row = 0; row < sheet.rows; row++) {
    for (let col = 0; col < sheet.cols; col++) {
      const cell = sheet.cell(row, col);
      if (cell && cell.text.toLocaleLowerCase().includes(needle)) {
        found.push({ row, col });
        if (found.length >= limit) return found;
      }
    }
  }
  return found;
}
