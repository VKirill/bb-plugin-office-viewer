// IronCalc workbook: the file's cells are loaded into the engine, which then
// owns values, formulas and recalculation while the sheet is open. Saving
// turns the touched cells back into surgical CellEdits.
import * as XLSX from "xlsx";
import { initSync, Model } from "@ironcalc/wasm";
import { textCell, type Cell, type Sheet } from "./sheet.ts";
import { parseInput, type Range } from "./edits.ts";
import { engineFormula, fileFormula, isFormula, normalizeFormula } from "./formula.ts";
import type { CellEdit } from "./xlsx-patch.ts";

let initialized = false;

/** Bump together with the @ironcalc/wasm dependency: browsers cache the module under this version. */
export const ENGINE_VERSION = "0.8.4";

export function initEngine(wasm: Uint8Array) {
  if (initialized) return;
  initSync({ module: wasm as Uint8Array<ArrayBuffer> });
  initialized = true;
}

export type Workbook = {
  model: Model;
  /** The file as parsed by SheetJS; used for merges, widths and change detection. */
  sheets: Sheet[];
  mode: "xlsx" | "csv";
  /** Formulas the engine can't compute (e.g. unknown functions): the file's cached text. */
  unsupported: Map<string, string>;
};

const ENGINE_ERRORS = new Set(["#NAME?", "#N/IMPL", "#N/IMPL!", "#ERROR!", "#ERROR?"]);
/** Text IronCalc would otherwise read as a number, date, boolean, error or formula. */
const LOOKS_TYPED = /^\s*[=+\-@$#(]|^\s*[\d.]|^(true|false)$|%\s*$/i;

export const literalInput = (text: string) => (LOOKS_TYPED.test(text) ? `'${text}` : text);
const csvInput = (text: string) => (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(text) ? text : literalInput(text));
export const unsupportedKey = (sheet: number, row: number, col: number) => `${sheet}:${row}:${col}`;

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function inputFor(cell: Cell, mode: "xlsx" | "csv"): string {
  if (cell.formula) return `=${engineFormula(cell.formula.slice(1))}`;
  if (mode === "csv") return csvInput(cell.text);
  if (typeof cell.value === "boolean") return cell.value ? "TRUE" : "FALSE";
  if (typeof cell.value === "number") return cell.numeric ? String(cell.value) : cell.text;
  return literalInput(cell.text);
}

export function buildWorkbook(sheets: Sheet[], mode: "xlsx" | "csv"): Workbook {
  let model: Model;
  try {
    model = new Model("Workbook", "en", timezone(), "en");
  } catch {
    model = new Model("Workbook", "en", "UTC", "en");
  }
  model.pauseEvaluation();
  sheets.forEach((sheet, index) => {
    if (index > 0) model.newSheet();
    try {
      model.renameSheet(index, sheet.name);
    } catch {
      /* keep the engine's name; formulas referring to it by name show #REF! */
    }
    for (let col = 0; col < sheet.cols; col++) {
      let run: { format: string; from: number; to: number } | null = null;
      const flush = () => {
        if (run) model.updateRangeStyle({ sheet: index, row: run.from + 1, column: col + 1, width: 1, height: run.to - run.from + 1 }, "num_fmt", run.format);
        run = null;
      };
      for (let row = 0; row < sheet.rows; row++) {
        const cell = sheet.cell(row, col);
        if (!cell || (cell.text === "" && !cell.formula)) {
          flush();
          continue;
        }
        try {
          model.setUserInput(index, row + 1, col + 1, inputFor(cell, mode));
        } catch {
          model.setUserInput(index, row + 1, col + 1, `'${cell.text}`);
        }
        // Formulas keep the file's format; otherwise the engine borrows one from their references.
        const format = mode !== "xlsx" ? null : cell.format && cell.format !== "General" ? cell.format : cell.formula ? "general" : null;
        if (format && run && run.format === format && run.to === row - 1) run.to = row;
        else {
          flush();
          if (format) run = { format, from: row, to: row };
        }
      }
      flush();
    }
  });
  model.resumeEvaluation();
  model.evaluate();
  // Start with an empty undo history.
  const fresh = Model.from_bytes(model.toBytes(), "en");
  model.free();

  const unsupported = new Map<string, string>();
  sheets.forEach((sheet, index) => {
    for (const { row, col } of sheet.formulas) {
      const cached = sheet.cell(row, col)?.text ?? "";
      const value = fresh.getFormattedCellValue(index, row + 1, col + 1);
      if (cached !== "" && ENGINE_ERRORS.has(value) && cached !== value) unsupported.set(unsupportedKey(index, row, col), cached);
    }
  });
  return { model: fresh, sheets, mode, unsupported };
}

const URL_RE = /^https?:\/\/\S+$/i;

/** A cell as the engine currently computes it. */
export function engineCell(workbook: Workbook, sheet: number, row: number, col: number): Cell | null {
  const { model } = workbook;
  const content = model.getCellContent(sheet, row + 1, col + 1);
  if (content === "") return null;
  const cached = workbook.unsupported.get(unsupportedKey(sheet, row, col));
  const text = cached ?? model.getFormattedCellValue(sheet, row + 1, col + 1);
  const type = model.getCellType(sheet, row + 1, col + 1);
  return {
    ...textCell(text),
    numeric: type === 1,
    formula: content.startsWith("=") ? content : null,
    link: URL_RE.test(text.trim()) ? text.trim() : null,
    value: content,
    unsupported: cached !== undefined,
  };
}

export function engineFormat(workbook: Workbook, sheet: number, row: number, col: number): string {
  return workbook.model.getCellStyle(sheet, row + 1, col + 1).style.num_fmt;
}

/** Applies what the user typed; returns false when the input was rejected by the engine. */
export function applyInput(workbook: Workbook, sheet: number, row: number, col: number, draft: string): void {
  const { model } = workbook;
  if (draft === "") {
    model.rangeClearContents(sheet, row + 1, col + 1, row + 1, col + 1);
    return;
  }
  workbook.unsupported.delete(unsupportedKey(sheet, row, col));
  if (workbook.mode === "csv") {
    model.setUserInput(sheet, row + 1, col + 1, isFormula(draft) ? normalizeFormula(draft) : csvInput(draft));
    return;
  }
  if (isFormula(draft) && draft.length > 1) {
    model.setUserInput(sheet, row + 1, col + 1, normalizeFormula(draft));
    return;
  }
  const format = engineFormat(workbook, sheet, row, col);
  const isDate = format !== "general" && XLSX.SSF.is_date(format);
  const edit = parseInput(draft, isDate ? { ...textCell(""), isDate } : null, "xlsx");
  const area = { sheet, row: row + 1, column: col + 1, width: 1, height: 1 };
  switch (edit.kind) {
    case "clear":
      model.rangeClearContents(sheet, row + 1, col + 1, row + 1, col + 1);
      return;
    case "boolean":
      model.setUserInput(sheet, row + 1, col + 1, edit.value ? "TRUE" : "FALSE");
      return;
    case "number": {
      if (/%\s*$/.test(draft)) {
        model.setUserInput(sheet, row + 1, col + 1, `${draft.replace(/[\s\u00a0%]/g, "").replace(",", ".")}%`);
        return;
      }
      model.setUserInput(sheet, row + 1, col + 1, String(edit.value));
      const typedDate = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(draft.trim());
      if (typedDate && !isDate) model.updateRangeStyle(area, "num_fmt", /\d:\d{2}$/.test(draft.trim()) ? "dd.mm.yyyy hh:mm" : "dd.mm.yyyy");
      return;
    }
    case "string":
      model.setUserInput(sheet, row + 1, col + 1, literalInput(edit.text));
      return;
    case "formula":
      model.setUserInput(sheet, row + 1, col + 1, normalizeFormula(`=${edit.formula}`));
  }
}

/**
 * The number behind a cell. For dates and times the engine returns formatted
 * text, so the format is switched to General for one read and undone.
 */
function rawNumber(workbook: Workbook, sheet: number, row: number, col: number, content: string): number {
  const direct = content.trim() === "" ? NaN : Number(content);
  if (Number.isFinite(direct)) return direct;
  const { model } = workbook;
  model.updateRangeStyle({ sheet, row: row + 1, column: col + 1, width: 1, height: 1 }, "num_fmt", "general");
  const general = Number(model.getCellContent(sheet, row + 1, col + 1));
  model.undo();
  return general;
}

/** Edits to write for cells the user touched; cells equal to the file are skipped. */
export function editsForSave(workbook: Workbook, touched: Iterable<{ sheet: number; row: number; col: number }>): Map<number, CellEdit[]> {
  const { model, sheets, mode } = workbook;
  const bySheet = new Map<number, CellEdit[]>();
  const push = (sheet: number, edit: CellEdit) => bySheet.set(sheet, [...(bySheet.get(sheet) ?? []), edit]);
  for (const { sheet, row, col } of touched) {
    const base = sheets[sheet]?.cell(row, col) ?? null;
    const content = model.getCellContent(sheet, row + 1, col + 1);
    if (mode === "csv") {
      const text = content === "" ? "" : content.startsWith("=") ? model.getFormattedCellValue(sheet, row + 1, col + 1) : content.replace(/^'/, "");
      if (text !== (base?.text ?? "")) push(sheet, text === "" ? { row, col, kind: "clear" } : { row, col, kind: "string", text });
      continue;
    }
    if (content === "") {
      if (base) push(sheet, { row, col, kind: "clear" });
      continue;
    }
    const format = model.getCellStyle(sheet, row + 1, col + 1).style.num_fmt;
    const formatChanged = format !== "general" && format !== (base?.format ?? "General");
    if (content.startsWith("=")) {
      const formula = content.slice(1);
      if (!base?.formula || engineFormula(base.formula.slice(1)) !== formula || formatChanged) push(sheet, { row, col, kind: "formula", formula: fileFormula(formula), ...(formatChanged ? { format } : {}) });
      continue;
    }
    const type = model.getCellType(sheet, row + 1, col + 1);
    if (type === 4) {
      const value = content.toUpperCase() === "TRUE";
      if (base?.formula || base?.value !== value) push(sheet, { row, col, kind: "boolean", value });
      continue;
    }
    const number = type === 1 ? rawNumber(workbook, sheet, row, col, content) : NaN;
    if (Number.isFinite(number)) {
      if (base?.formula || base?.value !== number || formatChanged) push(sheet, { row, col, kind: "number", value: number, ...(formatChanged ? { format } : {}) });
      continue;
    }
    const text = content.startsWith("'") ? content.slice(1) : content;
    if (base?.formula || typeof base?.value !== "string" || base.text !== text) push(sheet, { row, col, kind: "string", text });
  }
  return bySheet;
}

/** Sum, average and count of the selection, like Excel's status bar. */
export function selectionStats(workbook: Workbook, sheet: number, range: Range, rows: number, cols: number): { count: number; numbers: number; sum: number } | null {
  const r2 = Math.min(range.r2, rows - 1);
  const c2 = Math.min(range.c2, cols - 1);
  if ((r2 - range.r1 + 1) * (c2 - range.c1 + 1) > 200_000) return null;
  let count = 0;
  let numbers = 0;
  let sum = 0;
  for (let row = range.r1; row <= r2; row++) {
    for (let col = range.c1; col <= c2; col++) {
      const cell = engineCell(workbook, sheet, row, col);
      if (!cell) continue;
      count++;
      if (!cell.numeric || cell.unsupported) continue;
      const raw = cell.formula ? cell.text : cell.value;
      if (typeof raw !== "string") continue;
      let text = raw.trim();
      if (cell.formula) {
        if (/\d[./:]\d+[./:]/.test(text)) continue;
        const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
        const percent = text.endsWith("%");
        text = text.replace(/[^\d.eE-]/g, "").replace(/^-/, "");
        const value = Number(text);
        if (!Number.isFinite(value) || text === "") continue;
        sum += (negative ? -value : value) / (percent ? 100 : 1);
      } else {
        const value = Number(text);
        if (!Number.isFinite(value)) continue;
        sum += value;
      }
      numbers++;
    }
  }
  return { count, numbers, sum };
}
