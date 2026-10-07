import assert from "node:assert/strict";
import { test } from "node:test";
import { activeCall, applyCompletion, canPoint, completionAt, engineFormula, fileFormula, insertReference, MAX_ROW, normalizeFormula, referenceColors, referenceSpans, referenceText } from "./formula.ts";

test("reference spans: cells, ranges, absolute, sheets, whole rows/columns; strings and functions ignored", () => {
  const text = `=SUM($B$3:B5)+'Лист 2'!a1+LOG10(2)+COUNTIF(C:C,"A1")+Данные!2:3`;
  const spans = referenceSpans(text);
  assert.deepEqual(spans.map((s) => [s.text, s.sheet, s.range.r1, s.range.c1, s.range.r2, s.range.c2]), [
    ["$B$3:B5", null, 2, 1, 4, 1],
    ["'Лист 2'!a1", "Лист 2", 0, 0, 0, 0],
    ["C:C", null, 0, 2, MAX_ROW, 2],
    ["Данные!2:3", "Данные", 1, 0, 2, 16_383],
  ]);
  assert.equal(text.slice(spans[0].start, spans[0].end), "$B$3:B5");
  const colors = referenceColors(referenceSpans("=A1+B2+a1"));
  assert.equal(colors.size, 2);
  assert.deepEqual(referenceSpans("Итого A1"), []);
});

test("point mode: after operators and separators, and replacing the last pointed reference", () => {
  assert.equal(canPoint("=", 1, null), true);
  assert.equal(canPoint("=SUM(", 5, null), true);
  assert.equal(canPoint("=A1+ ", 5, null), true);
  assert.equal(canPoint("=A1", 3, null), false);
  assert.equal(canPoint("=A1", 3, { start: 1, end: 3 }), true);
  assert.equal(canPoint("45", 2, null), false);
  assert.equal(canPoint('="a+', 4, null), false);

  let state = insertReference("=SUM(", 5, null, "B3");
  assert.deepEqual(state, { text: "=SUM(B3", caret: 7, point: { start: 5, end: 7 } });
  state = insertReference(state.text, state.caret, state.point, "B3:B5");
  assert.deepEqual(state, { text: "=SUM(B3:B5", caret: 10, point: { start: 5, end: 10 } });
  assert.equal(insertReference("=A1+)", 4, null, "C2").text, "=A1+C2)");
});

test("reference text", () => {
  assert.equal(referenceText({ r1: 2, c1: 1, r2: 2, c2: 1 }, null), "B3");
  assert.equal(referenceText({ r1: 2, c1: 1, r2: 9, c2: 3 }, "Лист 2"), "'Лист 2'!B3:D10");
  assert.equal(referenceText({ r1: 0, c1: 2, r2: MAX_ROW, c2: 2 }, "Данные"), "Данные!C:C");
  assert.equal(referenceText({ r1: 4, c1: 0, r2: 4, c2: 16_383 }, null), "5:5");
});

test("completion in English and Russian, applied with an opening parenthesis", () => {
  const en = completionAt("=1+sumi", 7)!;
  assert.deepEqual([en.start, en.token, en.items.map((f) => f.name)], [3, "sumi", ["SUMIF", "SUMIFS"]]);
  assert.deepEqual(applyCompletion("=1+sumi", en, en.items[1]), { text: "=1+SUMIFS(", caret: 10 });
  const ru = completionAt("=впр", 4)!;
  assert.equal(ru.items[0].name, "VLOOKUP");
  assert.deepEqual(applyCompletion("=впр", ru, ru.items[0]), { text: "=ВПР(", caret: 5 });
  assert.equal(completionAt("=A1", 3), null);
  assert.equal(completionAt('="sum', 5), null);
  assert.equal(completionAt("sum", 3), null);
});

test("active call and argument index", () => {
  const call = activeCall('=IF(A1>0, ROUND(B1, ', 20)!;
  assert.deepEqual([call.fn.name, call.arg], ["ROUND", 1]);
  assert.deepEqual(activeCall("=ЕСЛИ(A1;", 9)?.fn.name, "IF");
  assert.equal(activeCall("=ROUND(1,2)+", 12), null);
});

test("Russian names and semicolons are normalized; file prefixes round-trip", () => {
  assert.equal(normalizeFormula('=ЕСЛИ(СУММ(A1:A3)>0;"да;нет";ВПР(B1;C:D;2;ЛОЖЬ))'), '=IF(SUM(A1:A3)>0,"да;нет",VLOOKUP(B1,C:D,2,FALSE))');
  assert.equal(normalizeFormula("=SUM(A1,B1)+{1;2}"), "=SUM(A1,B1)+{1;2}");
  assert.equal(fileFormula('XLOOKUP(A1,B:B,C:C)+SUM(1)&"UNIQUE("'), '_xlfn.XLOOKUP(A1,B:B,C:C)+SUM(1)&"UNIQUE("');
  assert.equal(engineFormula("_xlfn.XLOOKUP(A1,B:B,_xlfn._xlws.SORT(C:C))"), "XLOOKUP(A1,B:B,SORT(C:C))");
  assert.equal(fileFormula("_xlfn.IFS(A1,1)"), "_xlfn.IFS(A1,1)");
});
