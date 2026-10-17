import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement } from "./model.ts";
import {
  applyZOrder,
  buildMenuItems,
  nudgeZOrder,
  zOrderOpFromAction,
  type MenuBuildContext,
} from "./menus.ts";

const baseCtx = (): MenuBuildContext => ({
  selectedElementIds: ["b"],
  targetElementId: "b",
  canPaste: true,
  canGroup: true,
  canUngroup: false,
  selectionLocked: false,
  selectionHidden: false,
  pageCount: 2,
  canDeletePage: true,
});

test("outline menu includes z-order rename and delete", () => {
  const items = buildMenuItems({ kind: "outlineLayer", elementId: "b" }, baseCtx());
  const ids = items.map((item) => item.id);
  assert.deepEqual(ids, [
    "bringToFront",
    "bringForward",
    "sendBackward",
    "sendToBack",
    "group",
    "ungroup",
    "lock",
    "hide",
    "rename",
    "delete",
  ]);
});

test("canvas empty menu paste and select all", () => {
  const items = buildMenuItems({ kind: "canvasEmpty" }, { ...baseCtx(), canPaste: false });
  assert.ok(items.some((item) => item.id === "paste" && item.disabled));
  assert.ok(items.some((item) => item.id === "selectAll"));
});

test("nudgeZOrder swaps with neighbor", () => {
  const elements = [
    { ...defaultElement("Box", 0, 0), id: "a" },
    { ...defaultElement("Box", 10, 0), id: "b" },
    { ...defaultElement("Box", 20, 0), id: "c" },
  ];
  const up = nudgeZOrder(elements, ["b"], 1);
  assert.deepEqual(up.map((el) => el.id), ["a", "c", "b"]);
  const down = nudgeZOrder(elements, ["b"], -1);
  assert.deepEqual(down.map((el) => el.id), ["b", "a", "c"]);
});

test("applyZOrder front and back", () => {
  const elements = [
    { ...defaultElement("Box", 0, 0), id: "a" },
    { ...defaultElement("Box", 10, 0), id: "b" },
    { ...defaultElement("Box", 20, 0), id: "c" },
  ];
  assert.deepEqual(applyZOrder(elements, ["a"], "bringToFront").map((el) => el.id), ["b", "c", "a"]);
  assert.deepEqual(applyZOrder(elements, ["c"], "sendToBack").map((el) => el.id), ["c", "a", "b"]);
});

test("zOrderOpFromAction maps menu ids", () => {
  assert.equal(zOrderOpFromAction("bringForward"), "bringForward");
  assert.equal(zOrderOpFromAction("sendToBack"), "sendToBack");
  assert.equal(zOrderOpFromAction("delete"), null);
});
