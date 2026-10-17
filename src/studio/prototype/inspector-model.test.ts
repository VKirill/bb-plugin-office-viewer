import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement } from "./model.ts";
import {
  applyStyleToElements,
  createRadioGroup,
  mergeStylePatch,
  mixedStyleValue,
  pasteTableTsv,
  readTable,
  setRadioChecked,
  setTableCell,
  tableCellNav,
  writeStringList,
  writeTable,
  wireframeElementBoxStyle,
} from "./inspector-model.ts";

test("mergeStylePatch keeps unrelated fields on element", () => {
  const el = { ...defaultElement("Box", 0, 0), note: "keep" };
  const next = mergeStylePatch(el, "base", { fill: "#eee" });
  assert.equal(next.note, "keep");
  assert.equal(next.style?.base?.fill, "#eee");
  assert.equal(el.style, undefined);
});

test("mixed style value detects differences", () => {
  const a = mergeStylePatch(defaultElement("Box", 0, 0), "base", { fill: "#111" });
  const b = mergeStylePatch(defaultElement("Box", 8, 0), "base", { fill: "#222" });
  assert.equal(mixedStyleValue([a, b], "base", "fill"), "mixed");
  assert.equal(mixedStyleValue([a, a], "base", "fill"), "#111");
});

test("wireframeElementBoxStyle maps element.style opacity for canvas", () => {
  const el = mergeStylePatch(defaultElement("Box", 0, 0), "base", { opacity: 0.1, fill: "#336699" });
  const css = wireframeElementBoxStyle(el);
  assert.equal(css.opacity, 0.1);
  assert.equal(css.background, "#336699");
  const padded = mergeStylePatch({ ...el, props: { ...el.props, padding: 12 } }, "base", {});
  assert.equal(wireframeElementBoxStyle(padded).padding, 12);
  assert.equal(wireframeElementBoxStyle(padded).boxSizing, "border-box");
});

test("applyStyleToElements updates selection only", () => {
  const a = defaultElement("Box", 0, 0);
  const b = defaultElement("Box", 8, 0);
  const out = applyStyleToElements([a, b], new Set([a.id]), "hover", { color: "red" });
  assert.equal(out[0]!.style?.effects?.hover?.color, "red");
  assert.equal(out[1]!.style?.effects?.hover?.color, undefined);
});

test("radio group assign and exclusive check", () => {
  let elements = [
    { ...defaultElement("Radio", 0, 0), id: "r1" },
    { ...defaultElement("Radio", 0, 24), id: "r2" },
  ];
  elements = createRadioGroup(elements, ["r1", "r2"]);
  const group = elements[0]!.props.group;
  assert.ok(typeof group === "string" && group);
  elements = setRadioChecked(elements, "r1", true);
  assert.equal(elements[0]!.props.checked, true);
  assert.equal(elements[1]!.props.checked, false);
  elements = setRadioChecked(elements, "r2", true);
  assert.equal(elements[0]!.props.checked, false);
  assert.equal(elements[1]!.props.checked, true);
});

test("table read write and TSV paste", () => {
  const el = { ...defaultElement("Table", 0, 0), props: { columns: 2, rows: 2 } };
  const model = readTable(el);
  assert.equal(model.cells[0]![0], "1,1");
  const edited = setTableCell(model, 0, 0, "A");
  const saved = writeTable(el, edited);
  assert.equal(readTable(saved).cells[0]![0], "A");
  const pasted = pasteTableTsv(edited, "x\ty\n1\t2", 0, 0);
  assert.equal(pasted.cells[0]![0], "x");
  assert.equal(pasted.cells[1]![1], "2");
});

test("table cell navigation", () => {
  assert.deepEqual(tableCellNav(0, 0, 3, 3, "Tab", false), { row: 0, col: 1 });
  assert.deepEqual(tableCellNav(0, 2, 3, 3, "Tab", false), { row: 1, col: 0 });
  assert.deepEqual(tableCellNav(0, 0, 3, 3, "Enter", false), { row: 1, col: 0 });
});

test("list editor write", () => {
  const el = defaultElement("List", 0, 0);
  const next = writeStringList(el, "items", ["One", "Two"]);
  assert.deepEqual(next.props.items, ["One", "Two"]);
});
