// CSV/TSV read and write that round-trips a file's delimiter, line endings,
// BOM and encoding, so saving an edit changes only the edited fields.

export type CsvEncoding = "utf-8" | "windows-1251";

export type CsvFile = {
  rows: string[][];
  /** Fields that were quoted in the file stay quoted on save. */
  quoted: boolean[][];
  delimiter: string;
  eol: "\n" | "\r\n";
  bom: boolean;
  encoding: CsvEncoding;
  /** Whether the file ends with a line break. */
  trailingEol: boolean;
};

const CANDIDATES = [";", ",", "\t", "|"];

function decode(bytes: Uint8Array): { text: string; encoding: CsvEncoding } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1251").decode(bytes), encoding: "windows-1251" };
  }
}

/** Delimiter that occurs most often outside quotes on the first line. */
function detectDelimiter(text: string): string {
  const counts = new Map(CANDIDATES.map((d) => [d, 0]));
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  let best = ",";
  let max = 0;
  for (const [d, n] of counts) if (n > max) [best, max] = [d, n];
  return best;
}

export function parseCsv(bytes: Uint8Array, extension: string): CsvFile {
  const decoded = decode(bytes);
  let text = decoded.text;
  const bom = text.charCodeAt(0) === 0xfeff;
  if (bom) text = text.slice(1);
  const delimiter = extension === "tsv" ? "\t" : detectDelimiter(text);
  const eol = /\r\n/.test(text) ? "\r\n" : "\n";
  const trailingEol = /\r?\n$/.test(text);

  const rows: string[][] = [];
  const quotedRows: boolean[][] = [];
  let row: string[] = [];
  let rowQuoted: boolean[] = [];
  let field = "";
  let quoted = false;
  let wasQuoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "" && !wasQuoted) {
      quoted = true;
      wasQuoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      rowQuoted.push(wasQuoted);
      field = "";
      wasQuoted = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rowQuoted.push(wasQuoted);
      rows.push(row);
      quotedRows.push(rowQuoted);
      row = [];
      rowQuoted = [];
      field = "";
      wasQuoted = false;
    } else field += ch;
  }
  if (field !== "" || wasQuoted || row.length > 0) {
    row.push(field);
    rowQuoted.push(wasQuoted);
    rows.push(row);
    quotedRows.push(rowQuoted);
  }
  return { rows, quoted: quotedRows, delimiter, eol, bom, encoding: decoded.encoding, trailingEol };
}

function encodeWindows1251(text: string): Uint8Array {
  const decoder = new TextDecoder("windows-1251");
  const table = new Map<string, number>();
  for (let byte = 0x80; byte <= 0xff; byte++) table.set(decoder.decode(new Uint8Array([byte])), byte);
  const out = new Uint8Array(text.length);
  let n = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) out[n++] = code;
    else if (table.has(ch)) out[n++] = table.get(ch)!;
    else throw new Error(`Character “${ch}” can't be saved in Windows-1251`);
  }
  return out.slice(0, n);
}

export function serializeCsv(file: CsvFile): Uint8Array {
  const needsQuotes = (value: string) => value.includes(file.delimiter) || /["\r\n]/.test(value);
  const lines = file.rows.map((row, r) =>
    row.map((value, c) => (file.quoted[r]?.[c] || needsQuotes(value) ? `"${value.replace(/"/g, '""')}"` : value)).join(file.delimiter),
  );
  const text = (file.bom ? "﻿" : "") + lines.join(file.eol) + (file.trailingEol ? file.eol : "");
  return file.encoding === "windows-1251" ? encodeWindows1251(text.replace(/^﻿/, "")) : new TextEncoder().encode(text);
}

/** Sets cells, growing rows and columns as needed. */
export function applyCsvEdits(file: CsvFile, edits: { row: number; col: number; text: string }[]): CsvFile {
  const rows = file.rows.map((row) => [...row]);
  for (const { row, col, text } of edits) {
    while (rows.length <= row) rows.push([]);
    const target = rows[row];
    while (target.length <= col) target.push("");
    target[col] = text;
  }
  return { ...file, rows };
}
