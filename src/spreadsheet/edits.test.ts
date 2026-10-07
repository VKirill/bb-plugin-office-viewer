import assert from "node:assert/strict";
import { test } from "node:test";
import { editorText, formatQuote, parseInput, parseTsv, rangeLabel, rangeTsv, toRange } from "./edits.ts";
import { textCell, type Cell } from "./sheet.ts";

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

test("editor text shows formulas and entered values without the text prefix", () => {
  assert.equal(editorText({ ...moneyCell, value: "45000" }), "45000");
  assert.equal(editorText({ ...textCell("0042"), value: "'0042" }), "0042");
  assert.equal(editorText({ ...textCell("7"), formula: "=A1+1" }), "=A1+1");
  assert.equal(editorText(null), "");
});

test("clipboard TSV with quoted tabs and line breaks", () => {
  assert.deepEqual(parseTsv('a\t"b\tc"\r\n"line 1\nline 2"\t""""\n'), [["a", "b\tc"], ["line 1\nline 2", '"']]);
  assert.deepEqual(parseTsv("42"), [["42"]]);
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
