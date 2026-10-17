import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement, newWireframe } from "./model.ts";
import {
  applyOverridesToElement,
  clearOverride,
  cloneElementsToMaster,
  countInstances,
  createComponentFromSelection,
  createInstanceFromComponent,
  detachInstance,
  filterComponents,
  instanceChildrenForRender,
  materializeInstance,
  readOverrides,
  resetOverrides,
  setOverride,
} from "./components.ts";

test("create component from selection replaces content with instance bounds", () => {
  const doc = newWireframe("Doc");
  const page = doc.pages[0]!;
  const a = defaultElement("Button", 16, 24);
  const b = defaultElement("Text", 40, 80);
  page.elements.push(a, b);
  const result = createComponentFromSelection(doc, page.elements, [a.id, b.id]);
  assert.ok(result);
  assert.equal(result!.doc.components?.length, 1);
  assert.equal(result!.instance.type, "Instance");
  assert.equal(page.elements.length, 2);
  const nextPage = [...page.elements.filter((el) => el.id !== a.id && el.id !== b.id), result!.instance];
  assert.equal(nextPage.length, 1);
  assert.equal(countInstances({ ...doc, components: result!.doc.components, pages: [{ ...page, elements: nextPage }] }, result!.doc.components![0]!.id), 1);
});

test("overrides apply to master props when rendering", () => {
  const doc = newWireframe("Doc");
  const master = defaultElement("Text", 0, 0);
  master.props = { text: "Hello" };
  const component = { id: "cmp1", name: "C", w: 80, h: 40, elements: [master] };
  let instance = defaultElement("Instance", 100, 100);
  instance.type = "Instance";
  instance.w = 80;
  instance.h = 40;
  instance.props = { componentId: "cmp1" };
  instance = setOverride(instance, master.id, "text", "World");
  const merged = applyOverridesToElement(master, instance);
  assert.equal(merged.props.text, "World");
  const rows = instanceChildrenForRender(instance, component);
  assert.equal(rows[0]!.props.text, "World");
});

test("detach expands instance to page elements", () => {
  const master = defaultElement("Button", 8, 8);
  const component = { id: "c1", name: "Btn", w: 120, h: 40, elements: [master] };
  const instance = { ...defaultElement("Instance", 200, 100), w: 120, h: 40, props: { componentId: "c1" } };
  const expanded = detachInstance(instance, component);
  assert.equal(expanded.length, 1);
  assert.equal(expanded[0]!.x, 208);
});

test("resetOverrides clears override map", () => {
  let instance = defaultElement("Instance", 0, 0);
  instance.type = "Instance";
  instance.props = { componentId: "c1" };
  instance = setOverride(instance, "m1", "text", "X");
  assert.ok(readOverrides(instance).size === 1);
  instance = resetOverrides(instance);
  assert.equal(readOverrides(instance).size, 0);
});

test("clearOverride removes one entry", () => {
  let instance = defaultElement("Instance", 0, 0);
  instance.type = "Instance";
  instance.props = { componentId: "c1" };
  instance = setOverride(instance, "m1", "text", "A");
  instance = setOverride(instance, "m2", "text", "B");
  instance = clearOverride(instance, "m1", "text");
  assert.equal(readOverrides(instance).size, 1);
});

test("cloneElementsToMaster preserves relative layout", () => {
  const parent = defaultElement("Box", 0, 0);
  parent.w = 120;
  parent.h = 80;
  const child = { ...defaultElement("Text", 16, 24), parentId: parent.id };
  const { elements, w, h } = cloneElementsToMaster([parent, child], [parent, child]);
  assert.ok(w >= 120);
  assert.ok(h >= 80);
  assert.equal(elements.length, 2);
});

test("createInstanceFromComponent uses component dimensions", () => {
  const doc = newWireframe("D");
  doc.components = [{ id: "c1", name: "Card", w: 160, h: 96, elements: [] }];
  const inst = createInstanceFromComponent(doc, "c1", 32, 48, []);
  assert.ok(inst);
  assert.equal(inst!.w, 160);
});

test("filterComponents matches name", () => {
  const list = filterComponents("nav", [{ id: "a", name: "Nav bar", w: 8, h: 8, elements: [] }]);
  assert.equal(list.length, 1);
});

test("materializeInstance places children at page coordinates", () => {
  const master = defaultElement("Label", 0, 0);
  const component = { id: "c1", name: "L", w: 80, h: 24, elements: [master] };
  const instance = { ...defaultElement("Instance", 48, 56), w: 80, h: 24, props: { componentId: "c1" } };
  const placed = materializeInstance(instance, component);
  assert.equal(placed[0]!.x, 48);
  assert.equal(placed[0]!.y, 56);
});
