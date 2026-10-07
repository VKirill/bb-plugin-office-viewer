import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { parseWorkbook } from "./sheet.ts";
import { PatchError, patchXlsx } from "./xlsx-patch.ts";

const styled = new Uint8Array(readFileSync(new URL("../../fixtures/styled.xlsx", import.meta.url)));
const budget = { index: 0, name: "Бюджет" };
const part = (bytes: Uint8Array, name: string) => strFromU8(unzipSync(bytes)[name]);

test("editing a value keeps the cell style and every other part byte-for-byte", () => {
  const out = patchXlsx(styled, budget, [{ row: 2, col: 1, kind: "number", value: 51000 }]);
  const before = unzipSync(styled);
  const after = unzipSync(out);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
  for (const name of Object.keys(before)) {
    if (name === "xl/worksheets/sheet1.xml" || name === "xl/workbook.xml") continue;
    assert.deepEqual(after[name], before[name], name);
  }
  const oldCell = /<c r="B3"[^>]*>/.exec(part(styled, "xl/worksheets/sheet1.xml"))![0];
  const newCell = /<c r="B3"[^>]*>/.exec(part(out, "xl/worksheets/sheet1.xml"))![0];
  assert.equal(/s="(\d+)"/.exec(newCell)?.[1], /s="(\d+)"/.exec(oldCell)?.[1]);
  const sheet1 = part(out, "xl/worksheets/sheet1.xml");
  assert.match(sheet1, /<conditionalFormatting/);
  assert.match(sheet1, /<dataValidations/);
  assert.match(sheet1, /<mergeCell ref="A1:C1"/);
  assert.match(part(out, "xl/workbook.xml"), /fullCalcOnLoad="1"/);

  const [sheet] = parseWorkbook(out, "xlsx");
  assert.equal(sheet.cell(2, 1)?.text, "51,000 ₽");
  assert.equal(sheet.cell(5, 1)?.formula, "=SUM(B3:B5)");
});

test("strings, formulas, booleans, new rows and cells in column order", () => {
  const out = patchXlsx(styled, budget, [
    { row: 3, col: 2, kind: "string", text: "Отсеян <&> \"x\"" },
    { row: 6, col: 1, kind: "formula", formula: "=B6*2" },
    { row: 2, col: 3, kind: "boolean", value: true },
    { row: 2, col: 0, kind: "string", text: "Нейрофото 2" },
    { row: 20, col: 4, kind: "number", value: 7 },
  ]);
  const [sheet] = parseWorkbook(out, "xlsx");
  assert.equal(sheet.cell(3, 2)?.text, "Отсеян <&> \"x\"");
  assert.equal(sheet.cell(6, 1)?.formula, "=B6*2");
  assert.equal(sheet.cell(2, 3)?.text, "TRUE");
  assert.equal(sheet.cell(2, 0)?.text, "Нейрофото 2");
  assert.equal(sheet.cell(20, 4)?.text, "7");
  const xml = part(out, "xl/worksheets/sheet1.xml");
  const row3 = /<row r="3"[\s\S]*?<\/row>/.exec(xml)![0];
  assert.deepEqual([...row3.matchAll(/<c r="([A-Z]+)3"/g)].map((m) => m[1]), ["A", "B", "C", "D"]);
  assert.ok(xml.indexOf('<row r="7"') < xml.indexOf('<row r="21"'));
  assert.match(xml, /<dimension ref="A1:E21" ?\/>/);
});

test("clearing keeps a styled cell empty and removes an unstyled one", () => {
  const out = patchXlsx(styled, budget, [
    { row: 2, col: 1, kind: "clear" },
    { row: 4, col: 0, kind: "clear" },
  ]);
  const xml = part(out, "xl/worksheets/sheet1.xml");
  assert.match(xml, /<c r="B3" s="\d+"\/>/);
  const [sheet] = parseWorkbook(out, "xlsx");
  assert.equal(sheet.cell(2, 1), null);
  assert.equal(sheet.cell(4, 0), null);
});

test("sheet identity is checked by index and name", () => {
  assert.throws(() => patchXlsx(styled, { index: 0, name: "Другой" }, [{ row: 0, col: 0, kind: "clear" }]), PatchError);
  const out = patchXlsx(styled, { index: 1, name: "Второй" }, [{ row: 0, col: 0, kind: "string", text: "изменён" }]);
  assert.equal(parseWorkbook(out, "xlsx")[1].cell(0, 0)?.text, "изменён");
  assert.equal(part(out, "xl/worksheets/sheet1.xml"), part(styled, "xl/worksheets/sheet1.xml"));
});

function workbookWith(sheetData: string, extraParts: Record<string, string> = {}) {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>'),
    "xl/workbook.xml": strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId9" Type="calcChain" Target="calcChain.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`),
    "xl/calcChain.xml": strToU8("<calcChain/>"),
  };
  for (const [name, xml] of Object.entries(extraParts)) files[name] = strToU8(xml);
  return zipSync(files);
}

test("replacing a shared-formula master writes explicit formulas to its dependents and drops calcChain", () => {
  const bytes = workbookWith(
    '<row r="1"><c r="A1"><v>1</v></c><c r="B1"><f t="shared" ref="B1:B3" si="0">A1*2</f><v>2</v></c></row>' +
      '<row r="2"><c r="A2"><v>2</v></c><c r="B2"><f t="shared" si="0"/><v>4</v></c></row>' +
      '<row r="3"><c r="A3"><v>3</v></c><c r="B3"><f t="shared" si="0"/><v>6</v></c></row>',
  );
  const expanded: Record<string, string> = { B2: "A2*2", B3: "A3*2" };
  const out = patchXlsx(bytes, { index: 0, name: "S" }, [{ row: 0, col: 1, kind: "number", value: 5 }], (_, ref) => expanded[ref] ?? null);
  const xml = part(out, "xl/worksheets/sheet1.xml");
  assert.match(xml, /<c r="B1"><v>5<\/v><\/c>/);
  assert.match(xml, /<c r="B2"><f>A2\*2<\/f><v>4<\/v><\/c>/);
  assert.match(xml, /<c r="B3"><f>A3\*2<\/f><v>6<\/v><\/c>/);
  const files = unzipSync(out);
  assert.equal(files["xl/calcChain.xml"], undefined);
  assert.doesNotMatch(strFromU8(files["xl/_rels/workbook.xml.rels"]), /calcChain/);
  assert.doesNotMatch(strFromU8(files["[Content_Types].xml"]), /calcChain/);
  assert.match(strFromU8(files["xl/workbook.xml"]), /<calcPr calcId="191029" fullCalcOnLoad="1"\/>/);
});

test("array formulas and cells without references are refused", () => {
  const array = workbookWith('<row r="1"><c r="A1"><f t="array" ref="A1:A2">B1:B2*2</f><v>1</v></c></row>');
  assert.throws(() => patchXlsx(array, { index: 0, name: "S" }, [{ row: 0, col: 0, kind: "number", value: 1 }]), /array formula/);
  const noRefs = workbookWith("<row><c><v>1</v></c></row>");
  assert.throws(() => patchXlsx(noRefs, { index: 0, name: "S" }, [{ row: 0, col: 0, kind: "number", value: 1 }]), PatchError);
});

test("prefixed SpreadsheetML and an empty sheet", () => {
  const files = unzipSync(workbookWith(""));
  files["xl/worksheets/sheet1.xml"] = strToU8('<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData/></x:worksheet>');
  const out = patchXlsx(zipSync(files), { index: 0, name: "S" }, [{ row: 1, col: 1, kind: "string", text: "ok" }]);
  assert.match(part(out, "xl/worksheets/sheet1.xml"), /<x:sheetData><x:row r="2"><x:c r="B2" t="inlineStr"><x:is><x:t xml:space="preserve">ok<\/x:t><\/x:is><\/x:c><\/x:row><\/x:sheetData>/);
});

test("a number format adds or reuses a cell style without touching other styles", () => {
  const out = patchXlsx(styled, budget, [
    { row: 9, col: 0, kind: "number", value: 46282, format: "dd.mm.yyyy" },
    { row: 10, col: 0, kind: "number", value: 46283, format: "dd.mm.yyyy" },
    { row: 2, col: 1, kind: "number", value: 0.5, format: "0%" },
  ]);
  const [sheet] = parseWorkbook(out, "xlsx");
  assert.equal(sheet.cell(9, 0)?.text, "17.09.2026");
  assert.equal(sheet.cell(10, 0)?.text, "18.09.2026");
  assert.equal(sheet.cell(2, 1)?.text, "50%");
  const before = part(styled, "xl/styles.xml");
  const after = part(out, "xl/styles.xml");
  const xfCount = (xml: string) => Number(/<cellXfs count="(\d+)"/.exec(xml)![1]);
  assert.equal(xfCount(after), xfCount(before) + 2);
  assert.match(after, /formatCode="dd\.mm\.yyyy"/);
  const cellXfs = (xml: string) => /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)![1];
  assert.ok(cellXfs(after).startsWith(cellXfs(before)));
  const b3 = /<c r="B3" s="(\d+)"/.exec(part(out, "xl/worksheets/sheet1.xml"))![1];
  const xf = [...cellXfs(after).matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)][Number(b3)][0];
  assert.match(xf, /numFmtId="9"/);
  assert.match(xf, /fillId="[1-9]/);
});
