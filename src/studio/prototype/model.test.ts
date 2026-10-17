import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG, CATALOG_BY_TYPE, ELEMENT_TYPES, defaultElement, newWireframe, parseWireframe, snap } from "./model.ts";

test("parseWireframe round-trips a valid document", () => {
  const doc = newWireframe("Login");
  const button = defaultElement("Button", 16, 24);
  doc.elements.push({ ...button, note: "Primary action" });
  const again = parseWireframe(JSON.stringify(doc));
  assert.deepEqual(again, doc);
  assert.equal(again.format, "bb-wireframe");
  assert.equal(again.version, 1);
});

test("every type has catalog defaults and a numbered label", () => {
  assert.equal(CATALOG.length, ELEMENT_TYPES.length);
  const placed = [];
  for (const type of ELEMENT_TYPES) {
    const spec = CATALOG_BY_TYPE[type];
    assert.ok(spec.w % 8 === 0 && spec.h % 8 === 0, type);
    const first = defaultElement(type, 10, 14, placed);
    assert.equal(first.label, `${type} 1`);
    assert.equal(first.x, 8);
    assert.equal(first.y, 16);
    assert.deepEqual(first.props, spec.props);
    placed.push(first);
    const second = defaultElement(type, 0, 0, placed);
    assert.equal(second.label, `${type} 2`);
    placed.push(second);
  }
});

test("snap uses an 8px grid", () => {
  assert.equal(snap(0), 0);
  assert.equal(snap(3), 0);
  assert.equal(snap(4), 8);
  assert.equal(snap(11), 8);
  assert.equal(snap(12), 16);
  assert.equal(snap(13), 16);
  assert.equal(snap(20, 10), 20);
});

test("parseWireframe rejects a bad file", () => {
  assert.throws(() => parseWireframe("{"), SyntaxError);
  assert.throws(() => parseWireframe({ format: "other", version: 1, name: "A", canvas: { width: 100, height: 100, background: "#fff" }, elements: [] }));
  assert.throws(() => parseWireframe({ ...newWireframe(), version: 2 }));
  assert.throws(() => parseWireframe({ ...newWireframe(), elements: [{ id: "1", type: "Widget", label: "W", x: 0, y: 0, w: 8, h: 8, props: {} }] }));
  assert.throws(() => parseWireframe({ ...newWireframe(), elements: [{ id: "1", type: "Button", label: "B", x: 0, y: 0, w: 0, h: 8, props: {} }] }));
});
