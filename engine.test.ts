import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { applyInput, buildWorkbook, editsForSave, engineCell, initEngine, selectionStats } from "./engine.ts";
import { parseWorkbook } from "./sheet.ts";

initEngine(readFileSync(new URL("./node_modules/@ironcalc/wasm/wasm_bg.wasm", import.meta.url)));

function book(rows: unknown[][], name = "Данные") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Итог"], [{ t: "n", f: "SUM(Данные!B2:B4)", v: 0 }]]), "Сводка");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

const rows = [
  ["Канал", "Бюджет", "Дата"],
  ["Нейрофото", { t: "n", v: 45000, z: '#,##0 "₽"' }, { t: "n", v: 46266, z: "dd.mm.yyyy" }],
  ["ИИ", 38500, "01"],
  ["Бизнес", 27000, "TRUE"],
  ["Итого", { t: "n", f: "SUM(B2:B4)", v: 110500 }, { t: "n", f: "_xlfn.XLOOKUP(\"ИИ\",A2:A4,B2:B4)", v: 38500 }],
  ["Куб", { t: "n", f: "CUBEVALUE(\"x\")", v: 7 }],
];

test("loads values, formats, text that looks typed and cross-sheet formulas", () => {
  const wb = buildWorkbook(parseWorkbook(book(rows), "xlsx"), "xlsx");
  assert.equal(engineCell(wb, 0, 1, 1)?.text, "45,000 ₽");
  assert.equal(engineCell(wb, 0, 1, 2)?.text, "01.09.2026");
  assert.equal(engineCell(wb, 0, 2, 2)?.text, "01");
  assert.equal(engineCell(wb, 0, 3, 2)?.text, "TRUE");
  assert.equal(engineCell(wb, 0, 3, 2)?.numeric, false);
  assert.equal(engineCell(wb, 0, 4, 1)?.formula, "=SUM(B2:B4)");
  assert.equal(engineCell(wb, 0, 4, 2)?.text, "38500");
  assert.equal(engineCell(wb, 1, 1, 0)?.text, "110500");
  assert.equal(engineCell(wb, 0, 9, 9), null);
  assert.equal(wb.model.canUndo(), false);
  const cube = engineCell(wb, 0, 5, 1)!;
  assert.deepEqual([cube.text, cube.unsupported], ["7", true]);
});

test("typing recalculates dependents, including other sheets", () => {
  const wb = buildWorkbook(parseWorkbook(book(rows), "xlsx"), "xlsx");
  applyInput(wb, 0, 1, 1, "50 000");
  assert.equal(engineCell(wb, 0, 1, 1)?.text, "50,000 ₽");
  assert.equal(engineCell(wb, 0, 4, 1)?.text, "115500");
  assert.equal(engineCell(wb, 1, 1, 0)?.text, "115500");
  applyInput(wb, 0, 6, 1, "=СРЗНАЧ(B2:B4;100)");
  assert.equal(engineCell(wb, 0, 6, 1)?.formula, "=AVERAGE(B2:B4,100)");
  applyInput(wb, 0, 7, 0, "17.09.2026");
  assert.equal(engineCell(wb, 0, 7, 0)?.text, "17.09.2026");
  applyInput(wb, 0, 7, 1, "15%");
  assert.equal(engineCell(wb, 0, 7, 1)?.text, "15%");
  applyInput(wb, 0, 7, 2, "0042");
  assert.equal(engineCell(wb, 0, 7, 2)?.text, "42");
  wb.model.undo();
  assert.equal(engineCell(wb, 0, 7, 2), null);
});

test("save edits: only changed cells, file formula prefixes, number formats", () => {
  const wb = buildWorkbook(parseWorkbook(book(rows), "xlsx"), "xlsx");
  applyInput(wb, 0, 1, 1, "50000");
  applyInput(wb, 0, 2, 1, "38500");
  applyInput(wb, 0, 6, 0, "=XLOOKUP(\"Бизнес\",A2:A4,B2:B4)");
  applyInput(wb, 0, 7, 0, "17.09.2026");
  applyInput(wb, 0, 8, 0, "текст");
  applyInput(wb, 0, 3, 0, "");
  const touched = [[0, 1, 1], [0, 2, 1], [0, 6, 0], [0, 7, 0], [0, 8, 0], [0, 3, 0], [0, 4, 1]].map(([sheet, row, col]) => ({ sheet, row, col }));
  assert.deepEqual(editsForSave(wb, touched).get(0), [
    { row: 1, col: 1, kind: "number", value: 50000 },
    { row: 6, col: 0, kind: "formula", formula: '_xlfn.XLOOKUP("Бизнес",A2:A4,B2:B4)' },
    { row: 7, col: 0, kind: "number", value: 46282, format: "dd.mm.yyyy" },
    { row: 8, col: 0, kind: "string", text: "текст" },
    { row: 3, col: 0, kind: "clear" },
  ]);
});

test("csv keeps text as typed and saves computed formulas as values", () => {
  const csv = new TextEncoder().encode("Имя;Сумма\nАнна;100\nБорис;0042\n");
  const wb = buildWorkbook(parseWorkbook(csv, "csv"), "csv");
  assert.equal(engineCell(wb, 0, 2, 1)?.text, "0042");
  applyInput(wb, 0, 3, 1, "=B2*2");
  assert.equal(engineCell(wb, 0, 3, 1)?.text, "200");
  applyInput(wb, 0, 1, 0, "Анна");
  assert.deepEqual(editsForSave(wb, [{ sheet: 0, row: 3, col: 1 }, { sheet: 0, row: 1, col: 0 }]).get(0), [{ row: 3, col: 1, kind: "string", text: "200" }]);
});

test("selection stats skip text and parse formatted formula results", () => {
  const wb = buildWorkbook(parseWorkbook(book(rows), "xlsx"), "xlsx");
  assert.deepEqual(selectionStats(wb, 0, { r1: 0, c1: 1, r2: 4, c2: 1 }, 10, 5), { count: 5, numbers: 4, sum: 221000 });
});

test("the demo workbook and the styled fixture load", () => {
  for (const [path, sheets] of [["./docs/demo.xlsx", 4], ["./fixtures/styled.xlsx", 2]] as const) {
    const started = performance.now();
    const wb = buildWorkbook(parseWorkbook(new Uint8Array(readFileSync(new URL(path, import.meta.url))), "xlsx"), "xlsx");
    assert.equal(wb.model.getWorksheetsProperties().length, sheets);
    assert.ok(performance.now() - started < 5000);
  }
});
