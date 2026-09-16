import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { cellAddress, columnName, decodeText, extensionOf, findCells, parseWorkbook } from "./sheet.ts";

const encode = (text: string) => new TextEncoder().encode(text);

function xlsxBytes(build: (book: XLSX.WorkBook) => void): Uint8Array {
  const book = XLSX.utils.book_new();
  build(book);
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

test("column names and addresses follow Excel", () => {
  assert.deepEqual([0, 25, 26, 51, 52, 701, 702].map(columnName), ["A", "Z", "AA", "AZ", "BA", "ZZ", "AAA"]);
  assert.equal(cellAddress(4, 1), "B5");
});

test("extension is taken from the file name only", () => {
  assert.equal(extensionOf("/a.b/Отчёт.XLSX"), "xlsx");
  assert.equal(extensionOf("/a.b/README"), "");
});

test("text falls back to Windows-1251 and drops the BOM", () => {
  assert.equal(decodeText(encode("﻿имя;число")), "имя;число");
  const cp1251 = new Uint8Array([0xc8, 0xec, 0xff]); // "Имя"
  assert.equal(decodeText(cp1251), "Имя");
});

test("xlsx: sheets, hidden flag, formatted numbers, formulas, links, merges", () => {
  const bytes = xlsxBytes((book) => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Канал", "Подписчики", "Ссылка"],
      ["neuro", 1500, "https://t.me/neuro"],
      ["Итого", { t: "n", f: "SUM(B2:B2)", v: 1500 }],
    ]);
    ws["!merges"] = [{ s: { r: 3, c: 0 }, e: { r: 3, c: 2 } }];
    XLSX.utils.book_append_sheet(book, ws, "Каналы");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["x"]]), "Служебный");
    book.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  });
  const [main, hidden] = parseWorkbook(bytes, "xlsx");
  assert.equal(main.name, "Каналы");
  assert.equal(hidden.hidden, true);
  assert.equal(main.rows, 4);
  assert.equal(main.cols, 3);
  assert.deepEqual(main.merges, [{ r1: 3, c1: 0, r2: 3, c2: 2 }]);
  assert.deepEqual(main.cell(1, 1), { text: "1500", numeric: true, formula: null, link: null });
  assert.equal(main.cell(1, 2)?.link, "https://t.me/neuro");
  assert.equal(main.cell(2, 1)?.formula, "=SUM(B2:B2)");
  assert.equal(main.cell(0, 0)?.numeric, false);
  assert.equal(main.cell(9, 9), null);
  assert.ok(main.widths.every((w) => w >= 48 && w <= 320));
});

test("csv: semicolons, Russian text and number-like strings", () => {
  const [sheet] = parseWorkbook(encode("﻿Имя;Сумма\nАнна;1 250,50\n"), "csv");
  assert.equal(sheet.cols, 2);
  assert.equal(sheet.cell(1, 0)?.text, "Анна");
  assert.equal(sheet.cell(1, 1)?.text, "1 250,50");
  assert.equal(sheet.cell(1, 1)?.numeric, true);
});

test("tsv keeps commas inside cells", () => {
  const [sheet] = parseWorkbook(encode("a,b\tc\n"), "tsv");
  assert.equal(sheet.cell(0, 0)?.text, "a,b");
  assert.equal(sheet.cell(0, 1)?.text, "c");
});

test("search is case-insensitive in reading order", () => {
  const [sheet] = parseWorkbook(encode("Нейро,x\ny,нейрофото\n"), "csv");
  assert.deepEqual(findCells(sheet, "НЕЙРО"), [{ row: 0, col: 0 }, { row: 1, col: 1 }]);
  assert.deepEqual(findCells(sheet, "  "), []);
});
