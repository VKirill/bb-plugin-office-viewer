import assert from "node:assert/strict";
import { test } from "node:test";
import { displayEdit, editorText, formatQuote, formulaRefs, parseInput, rangeLabel, rangeTsv, staleFormulas, toRange } from "./edits.ts";
import { textCell, type Cell, type Sheet } from "./sheet.ts";

const dateCell: Cell = { ...textCell("01.09.2026"), numeric: true, format: "dd.mm.yyyy", isDate: true, value: 46266 };
const moneyCell: Cell = { ...textCell("45,000 ₽"), numeric: true, format: '#,##0 "₽"', value: 45000 };

test("typed input becomes numbers, dates, booleans, formulas or text", () => {
  assert.deepEqual(parseInput("", null, "xlsx"), { kind: "clear" });
  assert.deepEqual(parseInput("=SUM(A1:A3)", null, "xlsx"), { kind: "formula", formula: "SUM(A1:A3)" });
  assert.deepEqual(parseInput("1 250,50", moneyCell, "xlsx"), { kind: "number", value: 1250.5 });
  assert.deepEqual(parseInput("15%", null, "xlsx"), { kind: "number", value: 0.15 });
  assert.deepEqual(parseInput("16.09.2026", dateCell, "xlsx"), { kind: "number", value: 46281 });
  assert.deepEqual(parseInput("31.02.2026", dateCell, "xlsx"), { kind: "string", text: "31.02.2026" });
  assert.deepEqual(parseInput("16.09.2026", moneyCell, "xlsx"), { kind: "string", text: "16.09.2026" });
  assert.deepEqual(parseInput("ИСТИНА", null, "xlsx"), { kind: "boolean", value: true });
  assert.deepEqual(parseInput("Нейрофото", null, "xlsx"), { kind: "string", text: "Нейрофото" });
  assert.deepEqual(parseInput("=A1", null, "csv"), { kind: "string", text: "=A1" });
});

test("editor text and pending display keep the cell's number format", () => {
  assert.equal(editorText(moneyCell), "45000");
  assert.equal(editorText(dateCell), "01.09.2026");
  assert.equal(displayEdit({ kind: "number", value: 51000 }, moneyCell)?.text, "51,000 ₽");
  assert.equal(displayEdit({ kind: "number", value: 46281 }, dateCell)?.text, "16.09.2026");
  assert.equal(displayEdit({ kind: "formula", formula: "B2*2" }, null)?.formula, "=B2*2");
  assert.equal(displayEdit({ kind: "clear" }, moneyCell), null);
});

test("formula references: cells, ranges, columns, rows, other sheets; strings and functions ignored", () => {
  const refs = formulaRefs(`SUM($B$3:B5)+'Второй лист'!A1+LOG10(2)+COUNTIF(C:C,"A1")+Данные!2:3`, "Бюджет");
  assert.deepEqual(refs.map((r) => [r.sheet, r.range.r1, r.range.c1, r.range.r2 === Number.MAX_SAFE_INTEGER ? "∞" : r.range.r2, r.range.c2 === Number.MAX_SAFE_INTEGER ? "∞" : r.range.c2]), [
    ["Бюджет", 2, 1, 4, 1],
    ["Второй лист", 0, 0, 0, 0],
    ["Бюджет", 0, 2, "∞", 2],
    ["Данные", 1, 0, 2, "∞"],
  ]);
});

test("stale formulas follow dependencies across formulas and sheets", () => {
  const sheet = (name: string, formulas: Sheet["formulas"]): Sheet => ({ name, hidden: false, rows: 10, cols: 5, widths: [], merges: [], formulas, cell: () => null });
  const sheets = [
    sheet("A", [{ row: 5, col: 1, formula: "SUM(B1:B5)" }, { row: 6, col: 1, formula: "B6*2" }, { row: 7, col: 1, formula: "C1" }]),
    sheet("B", [{ row: 0, col: 0, formula: "A!B7+1" }]),
  ];
  assert.deepEqual([...staleFormulas(sheets, [{ sheet: "A", row: 2, col: 1 }])].sort(), ["A!5:1", "A!6:1", "B!0:0"]);
  assert.deepEqual([...staleFormulas(sheets, [{ sheet: "B", row: 2, col: 1 }])], []);
});

test("ranges, TSV copy and chat quote", () => {
  const range = toRange({ row: 5, col: 3 }, { row: 4, col: 1 });
  assert.deepEqual(range, { r1: 4, c1: 1, r2: 5, c2: 3 });
  assert.equal(rangeLabel(range), "B5:D6");
  assert.equal(rangeLabel({ r1: 0, c1: 0, r2: 0, c2: 0 }), "A1");
  const cells: Record<string, Cell> = { "4:1": textCell("Итого | всего"), "4:3": { ...moneyCell, formula: "=SUM(D1:D4)" }, "5:2": textCell("a\tb") };
  const cellAt = (r: number, c: number) => cells[`${r}:${c}`] ?? null;
  assert.equal(rangeTsv(range, cellAt), 'Итого | всего\t\t45,000 ₽\n\t"a\tb"\t');
  const quote = formatQuote({ path: "/p/demo.xlsx", host: "MAC Mini", sheet: "Сводка 1", range, cellAt, comment: " сумма неверная ", more: (r, c) => `+${r}/${c}` });
  assert.equal(quote, [
    "`/p/demo.xlsx` · 'Сводка 1'!B5:D6 · MAC Mini",
    "",
    "|  | B | C | D |",
    "|---|---|---|---|",
    "| 5 | Итого \\| всего |  | 45,000 ₽ `=SUM(D1:D4)` |",
    "| 6 |  | a\tb |  |",
    "",
    "сумма неверная",
  ].join("\n"));
  const big = formatQuote({ path: "p", host: "h", sheet: "S", range: { r1: 0, c1: 0, r2: 149, c2: 40 }, cellAt: () => null, more: (r, c) => `+${r} rows, +${c} cols` });
  assert.match(big, /\+50 rows, \+11 cols$/);
});
