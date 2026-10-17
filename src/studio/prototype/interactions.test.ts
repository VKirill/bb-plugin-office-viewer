import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement, newWireframe } from "./model.ts";
import {
  applyAction,
  applyActions,
  dispatchInteraction,
  elementHasInteractions,
  initialPreviewState,
  materializePage,
  newCaseId,
  newInteractionId,
  type Interaction,
} from "./interactions.ts";

test("applyAction show hide and toggle visibility", () => {
  const doc = newWireframe("Doc");
  const page = doc.pages[0]!;
  const box = defaultElement("Box", 0, 0);
  box.hidden = true;
  page.elements.push(box);
  let state = initialPreviewState(doc);
  state = applyAction(doc, state, { type: "show", targetId: box.id }).state;
  const visible = materializePage(page, state);
  assert.equal(visible.length, 1);
  state = applyAction(doc, state, { type: "hide", targetId: box.id }).state;
  assert.equal(materializePage(page, state).length, 0);
  state = applyAction(doc, state, { type: "toggle", targetId: box.id }).state;
  assert.equal(materializePage(page, state).length, 1);
});

test("goToPage updates preview page id", () => {
  const doc = newWireframe("Doc");
  const second = { ...doc.pages[0]!, id: "page2", name: "Page 2" };
  doc.pages.push(second);
  let state = initialPreviewState(doc);
  state = applyAction(doc, state, { type: "goToPage", pageId: "page2" }).state;
  assert.equal(state.pageId, "page2");
});

test("setPanelState and setText patch props", () => {
  const doc = newWireframe("Doc");
  const page = doc.pages[0]!;
  const panel = defaultElement("DynamicPanel", 0, 0);
  panel.props = { states: ["A", "B"], active: "A" };
  const label = defaultElement("Text", 0, 0);
  page.elements.push(panel, label);
  let state = initialPreviewState(doc);
  state = applyAction(doc, state, { type: "setPanelState", targetId: panel.id, state: "B" }).state;
  const resolved = materializePage(page, state).find((el) => el.id === panel.id)!;
  assert.equal(resolved.props.active, "B");
  state = applyAction(doc, state, { type: "setText", targetId: label.id, text: "Hi" }).state;
  const text = materializePage(page, state).find((el) => el.id === label.id)!;
  assert.equal(text.props.text, "Hi");
});

test("dispatchInteraction runs click actions from element", () => {
  const doc = newWireframe("Doc");
  const page = doc.pages[0]!;
  const btn = defaultElement("Button", 0, 0);
  const target = defaultElement("Box", 40, 40);
  target.hidden = true;
  const interaction: Interaction = {
    id: newInteractionId(),
    event: "click",
    cases: [{ id: newCaseId(), actions: [{ type: "show", targetId: target.id }] }],
  };
  btn.interactions = [interaction];
  page.elements.push(btn, target);
  const state = initialPreviewState(doc);
  const result = dispatchInteraction(doc, state, btn, "click");
  assert.equal(materializePage(page, result.state).some((el) => el.id === target.id), true);
  assert.equal(elementHasInteractions(btn), true);
});

test("applyActions collects openLink and wait effects", () => {
  const doc = newWireframe("Doc");
  const state = initialPreviewState(doc);
  const result = applyActions(doc, state, [
    { type: "openLink", url: "https://example.com" },
    { type: "wait", ms: 100 },
  ]);
  assert.equal(result.effects.length, 2);
  assert.equal(result.effects[0]!.type, "openLink");
});
