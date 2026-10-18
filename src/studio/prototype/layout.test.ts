import assert from "node:assert/strict";
import { test } from "node:test";
import { childrenOf } from "./containers.ts";
import {
  applyConstraints,
  defaultStackLayout,
  isAutoLayoutStack,
  layoutStack,
  readStackLayout,
  relayoutPageStacks,
  resolvePageView,
  wrapSelectionInStack,
  writeStackLayout,
} from "./layout.ts";
import { defaultElement, getActivePage, newWireframe, parseWireframe, SNAP, snap } from "./model.ts";

test("vertical stack lays out children with gap and padding", () => {
  const a = defaultElement("Button", 0, 0);
  const b = defaultElement("Button", 0, 0);
  a.w = 80;
  a.h = 40;
  b.w = 120;
  b.h = 32;
  let stack = writeStackLayout(defaultElement("Container", 0, 0), { ...defaultStackLayout(), gap: 16, padding: [8, 8, 8, 8] });
  stack.w = 200;
  stack.h = 200;
  const result = layoutStack(stack, [
    { ...a, parentId: stack.id },
    { ...b, parentId: stack.id },
  ]);
  assert.equal(result.children[0]!.y, 8);
  assert.equal(result.children[1]!.y, 8 + 40 + 16);
  assert.equal(result.children[0]!.w, 184);
});

test("hug stack shrinks to content", () => {
  const child = defaultElement("Text", 0, 0);
  child.w = 64;
  child.h = 24;
  const stack = writeStackLayout(defaultElement("Container", 0, 0, []), defaultStackLayout());
  const result = layoutStack(stack, [{ ...child, parentId: stack.id }]);
  assert.ok(result.stack.w <= 64 + SNAP * 2);
  assert.ok(result.stack.h <= 24 + SNAP * 2);
});

test("nested stacks relayout inside-out", () => {
  const innerChild = defaultElement("Label", 0, 0);
  let inner = writeStackLayout(defaultElement("Container", 0, 0), defaultStackLayout());
  inner = { ...inner, w: 160, h: 120 };
  const outerChild = { ...innerChild, id: "c1", parentId: inner.id };
  let outer = writeStackLayout(defaultElement("Container", 50, 50), defaultStackLayout());
  outer = { ...outer, w: 240, h: 200 };
  const nested = { ...inner, parentId: outer.id, x: 8, y: 8 };
  const laid = relayoutPageStacks([outer, nested, outerChild]);
  const innerLaid = laid.find((el) => el.id === inner.id)!;
  assert.ok(isAutoLayoutStack(innerLaid));
  assert.equal(childrenOf(laid, inner.id).length, 1);
});

test("wrapSelectionInStack creates auto layout container", () => {
  const doc = newWireframe("Form");
  const page = getActivePage(doc);
  const a = defaultElement("Button", 16, 16);
  const b = defaultElement("Button", 16, 80);
  page.elements.push(a, b);
  const { elements, stackId } = wrapSelectionInStack(page.elements, [a.id, b.id]);
  const stack = elements.find((el) => el.id === stackId);
  assert.ok(stack && isAutoLayoutStack(stack));
  assert.equal(childrenOf(elements, stackId).length, 2);
  parseWireframe(JSON.stringify({ ...doc, pages: [{ ...page, elements }] }));
});

test("applyConstraints pins right edge on resize", () => {
  const child = {
    ...defaultElement("Box", 100, 40),
    w: 40,
    h: 40,
    constraints: { horizontal: "right" as const, vertical: "top" as const },
  };
  const next = applyConstraints({ w: 200, h: 200 }, { w: 260, h: 200 }, child, child.constraints!);
  assert.equal(next.x, snap(child.x + 60));
});

test("resolvePageView applies tablet overrides", () => {
  const doc = newWireframe("Responsive");
  const page = getActivePage(doc);
  const btn = defaultElement("Button", 16, 16);
  page.elements.push(btn);
  page.views = { tablet: { elements: { [btn.id]: { x: 32, hidden: false } } } };
  const resolved = resolvePageView(page, "tablet");
  assert.equal(resolved.canvas.width, 768);
  assert.equal(resolved.elements.find((el) => el.id === btn.id)?.x, 32);
});
