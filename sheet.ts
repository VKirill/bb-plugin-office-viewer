// Spreadsheet model: parses workbook bytes with SheetJS into sheets the grid
// reads cell by cell. Pure and DOM-free so it runs under node tests.
import * as XLSX from "xlsx";

export const TEXT_EXTENSIONS = ["csv", "tsv"];
export const EXTENSIONS = ["xlsx", "xlsm", "xlsb", "xls", "ods", ...TEXT_EXTENSIONS];

export type Cell = {
  text: string;
  numeric: boolean;
  formula: string | null;
  link: string | null;
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

/** Text files are UTF-8 unless they fail to decode; then Windows-1251, common for Russian Excel exports. */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1251").decode(bytes);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
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
  if (!raw) return null;
  const text = raw.w ?? dottedDate(raw) ?? (raw.v == null ? "" : String(raw.v));
  const target = raw.l?.Target ?? (URL_RE.test(text.trim()) ? text.trim() : null);
  return {
    text,
    numeric: raw.t === "n" || (raw.t === "s" && text.trim() !== "" && NUMBER_RE.test(text.trim())),
    formula: raw.f ? `=${raw.f}` : null,
    link: target && URL_RE.test(target) ? target : null,
  };
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

  const chars = new Array<number>(cols).fill(0);
  for (let r = 0; r < Math.min(rows, SAMPLE_ROWS); r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const text = cell.w ?? (cell.v == null ? "" : String(cell.v));
      const longest = Math.max(...text.split("\n").map((line) => line.length));
      if (longest > chars[c]) chars[c] = longest;
    }
  }
  const declared = ws["!cols"] ?? [];
  const widths = chars.map((count, c) => {
    const excel = declared[c]?.wpx ?? (declared[c]?.wch ? declared[c].wch * CHAR_PX : undefined);
    const px = excel ?? count * CHAR_PX + 16;
    return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, px)));
  });

  return {
    name,
    hidden,
    rows,
    cols,
    widths,
    merges,
    cell: (row, col) => toCell(data[row]?.[col]),
  };
}

export function parseWorkbook(bytes: Uint8Array, extension: string): Sheet[] {
  const book = TEXT_EXTENSIONS.includes(extension)
    ? XLSX.read(decodeText(bytes), { type: "string", dense: true, raw: true, ...(extension === "tsv" ? { FS: "\t" } : {}) })
    : XLSX.read(bytes, { type: "array", dense: true, cellNF: true, cellStyles: false });
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
