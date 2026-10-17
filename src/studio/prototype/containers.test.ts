import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement } from "./model.ts";
import {
  absolutePosition,
  addPanelState,
  applyBindings,
  attachToScope,
  childrenOf,
  deletePanelState,
  duplicatePanelState,
  expandRepeaterRow,
  migrateDynamicPanel,
  normalizePageElements,
  normalizeRepeaterData,
  outlineTree,
  parseCsvGrid,
  parseTsvGrid,
  repeaterData,
  panelStates,
  renamePanelState,
  rootElements,
  withParent,
} from "./containers.ts";

test("parent coordinates accumulate to absolute position", () => {
  const panel = defaultElement("Container", 40, 32);
  const child = withParent(defaultElement("Text", 8, 16), { id: panel.id });
  const elements = [panel, child];
  const abs = absolutePosition(child, elements);
  assert.equal(abs.x, panel.x + child.x);
  assert.equal(abs.y, panel.y + child.y);
});

test("rootElements excludes nested children", () => {
  const panel = defaultElement("Container", 0, 0);
  const child = withParent(defaultElement("Text", 8, 8), { id: panel.id });
  assert.deepEqual(rootElements([panel, child]).map((el) => el.id), [panel.id]);
});

test("dynamic panel states migrate from string list", () => {
  const panel = defaultElement("DynamicPanel", 0, 0);
  panel.props = { states: ["A", "B"], active: "B" };
  const migrated = migrateDynamicPanel(panel);
  assert.deepEqual(migrated.props.states, ["A", "B"]);
  assert.equal(migrated.props.active, "B");
});

test("normalizePageElements migrates repeaters to data grid", () => {
  const repeater = defaultElement("Repeater", 0, 0);
  repeater.props = { layout: "table", columns: ["Name", "Role"], rows: 2 };
  const [next] = normalizePageElements([repeater]);
  const data = repeaterData(next);
  assert.equal(data.length, 2);
  assert.equal(data[0]!.length, 2);
});

test("applyBindings replaces column tokens", () => {
  const row = applyBindings("Hello {{Name}}", ["Name", "Role"], ["Ada", "Dev"]);
  assert.equal(row, "Hello Ada");
});

test("parseTsvGrid and parseCsvGrid read rows", () => {
  assert.deepEqual(parseTsvGrid("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsvGrid('name,role\n"Ada","Dev"'), [["name", "role"], ["Ada", "Dev"]]);
});

test("normalizeRepeaterData pads and trims columns", () => {
  assert.deepEqual(normalizeRepeaterData(["A", "B"], [["1"]]), [["1", ""]]);
});

test("panel state add duplicate rename delete", () => {
  let panel = defaultElement("DynamicPanel", 0, 0);
  panel.props = { states: ["One"], active: "One" };
  panel = addPanelState(panel, "Two");
  assert.ok(panelStates(panel).includes("Two"));
  const child = withParent(defaultElement("Text", 4, 4), { id: panel.id, state: "One" });
  const dup = duplicatePanelState(panel, "One", [panel, child]);
  assert.equal(childrenOf(dup.elements, panel.id, "One copy").length, 1);
  const renamed = renamePanelState(dup.panel, dup.elements, "One copy", "Copy");
  assert.ok(childrenOf(renamed, panel.id, "Copy").length === 1);
  const trimmed = deletePanelState(dup.panel, renamed, "Two");
  assert.ok(!trimmed.some((el) => el.parentState === "Two"));
});

test("attachToScope localizes coordinates inside container", () => {
  const box = defaultElement("Container", 100, 80);
  const el = defaultElement("Text", 0, 0);
  const scoped = attachToScope(el, { kind: "container", containerId: box.id }, 120, 96, [box]);
  assert.equal(scoped.parentId, box.id);
  assert.equal(scoped.x, 16);
  assert.equal(scoped.y, 16);
});

test("expandRepeaterRow applies bindings per row", () => {
  const repeater = defaultElement("Repeater", 0, 0);
  repeater.props = { columns: ["Title"], data: [["A"], ["B"]] };
  const template = withParent({ ...defaultElement("Text", 0, 0), props: { text: "{{Title}}" } }, { id: repeater.id });
  const row0 = expandRepeaterRow(repeater, [template], 0, ["A"])[0]!;
  assert.equal(row0.props.text, "A");
});

test("outlineTree nests children under container", () => {
  const panel = defaultElement("Container", 0, 0);
  const child = withParent(defaultElement("Text", 0, 0), { id: panel.id });
  const tree = outlineTree([panel, child]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]!.children.length, 1);
});
