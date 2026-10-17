import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement, newWireframe, parseWireframe } from "./model.ts";
import {
  addChoiceSibling,
  applyInlineDraft,
  checkRadio,
  enterOnListItem,
  itemIndexAt,
  readDraft,
  removeEmptyListItem,
  simpleEditKey,
  toggleCheckbox,
} from "./editing.ts";

test("double-click targets: button text and field placeholder", () => {
  assert.equal(simpleEditKey("Button"), "text");
  assert.equal(simpleEditKey("TextField"), "placeholder");
  assert.equal(simpleEditKey("Card"), "title");
  assert.equal(simpleEditKey("Container"), null);
  const button = defaultElement("Button", 0, 0);
  const next = applyInlineDraft(button, { id: button.id, target: { kind: "prop", key: "text" }, draft: "Save" });
  assert.equal(next.props.text, "Save");
  assert.equal(readDraft(button, { kind: "prop", key: "text" }), "Button");
});

test("Enter on a radio commits the label and adds a grouped radio below", () => {
  const first = defaultElement("Radio", 16, 24);
  const { elements, edit } = addChoiceSibling([first], first.id, "Email");
  assert.equal(elements.length, 2);
  assert.equal(elements[0]!.props.text, "Email");
  assert.equal(elements[1]!.type, "Radio");
  assert.equal(elements[1]!.props.text, "");
  assert.equal(elements[1]!.y, first.y + first.h);
  assert.equal(elements[1]!.x, first.x);
  assert.equal(elements[0]!.props.group, elements[1]!.props.group);
  assert.ok(typeof elements[0]!.props.group === "string" && elements[0]!.props.group);
  assert.equal(edit.id, elements[1]!.id);
  assert.equal(edit.draft, "");
  const doc = newWireframe("R");
  doc.elements = elements;
  assert.equal(parseWireframe(JSON.stringify(doc)).elements.length, 2);
});

test("checking a radio unchecks others in the group", () => {
  const a = defaultElement("Radio", 0, 0);
  const { elements } = addChoiceSibling([a], a.id, "A");
  const [first, second] = elements;
  const checked = checkRadio(checkRadio(elements, first!.id), second!.id);
  assert.equal(checked[0]!.props.checked, false);
  assert.equal(checked[1]!.props.checked, true);
});

test("Enter on a checkbox adds another below without exclusivity", () => {
  const box = { ...defaultElement("Checkbox", 8, 8), props: { text: "A", checked: true } };
  const { elements } = addChoiceSibling([box], box.id, "A");
  assert.equal(elements[0]!.props.checked, true);
  assert.equal(elements[1]!.type, "Checkbox");
  assert.equal(elements[1]!.y, box.y + box.h);
  assert.equal(elements[1]!.props.group, undefined);
  const toggled = toggleCheckbox(elements, elements[1]!.id);
  assert.equal(toggled[0]!.props.checked, true);
  assert.equal(toggled[1]!.props.checked, true);
});

test("Enter on a list item inserts an empty item after it", () => {
  const list = defaultElement("List", 0, 0);
  const { element, nextIndex } = enterOnListItem(list, "items", 0, "First");
  assert.deepEqual(element.props.items, ["First", "", "Item 2", "Item 3"]);
  assert.equal(nextIndex, 1);
});

test("Backspace on an empty list item removes it", () => {
  const list = defaultElement("List", 0, 0);
  const { element, nextIndex } = removeEmptyListItem(list, "items", 1);
  assert.deepEqual(element.props.items, ["Item 1", "Item 3"]);
  assert.equal(nextIndex, 1);
});

test("Nav/Tabs/ChoicePicker item index and draft", () => {
  const tabs = defaultElement("Tabs", 0, 0);
  tabs.w = 200;
  assert.equal(itemIndexAt(tabs, 10, 4), 0);
  assert.equal(itemIndexAt(tabs, 150, 4), 1);
  const choice = defaultElement("ChoicePicker", 0, 0);
  choice.props.value = "Option 2";
  assert.equal(itemIndexAt(choice, 0, 0), 1);
  const next = applyInlineDraft(choice, { id: choice.id, target: { kind: "item", key: "options", index: 1 }, draft: "Other" });
  assert.deepEqual(next.props.options, ["Option 1", "Other"]);
  assert.equal(next.props.value, "Other");
});
