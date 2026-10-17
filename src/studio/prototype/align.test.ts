import assert from "node:assert/strict";
import { test } from "node:test";
import { alignElements, distributeElements } from "./align.ts";
import type { WireframeElement } from "./model.ts";

function box(id: string, x: number, y: number, w: number, h: number): WireframeElement {
  return { id, type: "Button", label: id, x, y, w, h, props: {} };
}

test("align left/center/right uses the selection bounds", () => {
  const a = box("a", 16, 8, 40, 24);
  const b = box("b", 80, 40, 40, 24);
  const extra = box("c", 200, 0, 16, 16);
  const left = alignElements([a, b, extra], ["a", "b"], "left");
  assert.equal(left[0]!.x, 16);
  assert.equal(left[1]!.x, 16);
  assert.equal(left[2]!.x, 200);
  const right = alignElements([a, b], ["a", "b"], "right");
  assert.equal(right[0]!.x, 80);
  assert.equal(right[1]!.x, 80);
  const center = alignElements([a, b], ["a", "b"], "center");
  assert.equal(center[0]!.x, 48);
  assert.equal(center[1]!.x, 48);
});

test("align top/middle/bottom and a single element to the canvas", () => {
  const a = box("a", 16, 8, 40, 24);
  const b = box("b", 80, 40, 40, 24);
  const top = alignElements([a, b], ["a", "b"], "top");
  assert.equal(top[0]!.y, 8);
  assert.equal(top[1]!.y, 8);
  const middle = alignElements([a, b], ["a", "b"], "middle");
  assert.equal(middle[0]!.y, 24);
  assert.equal(middle[1]!.y, 24);
  const one = alignElements([a], ["a"], "center", { width: 200, height: 100 });
  assert.equal(one[0]!.x, 80);
  assert.equal(one[0]!.y, 8);
});

test("distribute spaces three or more; two is a no-op", () => {
  const a = box("a", 0, 0, 16, 16);
  const b = box("b", 40, 8, 16, 16);
  const c = box("c", 160, 24, 16, 16);
  const across = distributeElements([a, b, c], ["a", "b", "c"], "horizontal");
  assert.equal(across[0]!.x, 0);
  assert.equal(across[1]!.x, 80);
  assert.equal(across[2]!.x, 160);
  const down = distributeElements([a, b, c], ["a", "b", "c"], "vertical");
  assert.equal(down[0]!.y, 0);
  assert.equal(down[1]!.y, 16);
  assert.equal(down[2]!.y, 24);
  const pair = distributeElements([a, b], ["a", "b"], "horizontal");
  assert.equal(pair[0]!.x, 0);
  assert.equal(pair[1]!.x, 40);
});
