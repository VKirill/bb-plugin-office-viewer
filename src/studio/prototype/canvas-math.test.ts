import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement } from "./model.ts";
import {
  arrowNudge,
  CLICK_DRAG_THRESHOLD,
  clickSelection,
  constrainMove,
  distanceLinesFor,
  drawRect,
  expandToGroups,
  gridStep,
  groupIds,
  marqueeHitTest,
  nudgeStep,
  normalizeRect,
  resizeBox,
  snapAngle,
  snapDelta,
  snapRectToPeers,
  ungroupIds,
  zoomIn,
  zoomOut,
  zoomToBounds,
  zoomToFit,
} from "./canvas-math.ts";

test("marquee intersect vs contain", () => {
  const elements = [
    { ...defaultElement("Box", 0, 0), w: 40, h: 40 },
    { ...defaultElement("Box", 100, 100), w: 40, h: 40 },
  ];
  const marquee = normalizeRect(10, 10, 50, 50);
  assert.deepEqual(marqueeHitTest(elements, marquee, "intersect"), [elements[0]!.id]);
  assert.deepEqual(marqueeHitTest(elements, marquee, "contain"), []);
  const full = normalizeRect(95, 95, 145, 145);
  assert.deepEqual(marqueeHitTest(elements, full, "contain"), [elements[1]!.id]);
});

test("click selection with meta and shift", () => {
  assert.deepEqual(clickSelection(["a"], "b", false, false), ["b"]);
  assert.deepEqual(clickSelection(["a"], "a", false, false), ["a"]);
  assert.deepEqual(clickSelection(["a"], "b", true, false), ["a", "b"]);
  assert.deepEqual(clickSelection(["a", "b"], "b", true, false), ["a"]);
});

test("group and ungroup", () => {
  const elements = [
    { ...defaultElement("Box", 0, 0), id: "a" },
    { ...defaultElement("Box", 50, 0), id: "b" },
    { ...defaultElement("Box", 100, 0), id: "c" },
  ];
  const grouped = groupIds(elements, ["a", "b"]);
  const gid = grouped.find((el) => el.id === "a")!.groupId;
  assert.ok(gid);
  assert.equal(grouped.find((el) => el.id === "b")!.groupId, gid);
  assert.equal(grouped.find((el) => el.id === "c")!.groupId, undefined);
  const expanded = expandToGroups(grouped, ["a"]);
  assert.deepEqual(expanded.sort(), ["a", "b"]);
  const ungrouped = ungroupIds(grouped, ["a"]);
  assert.equal(ungrouped.find((el) => el.id === "a")!.groupId, undefined);
  assert.equal(ungrouped.find((el) => el.id === "b")!.groupId, undefined);
});

test("snap guides align edges", () => {
  const peers = [{ ...defaultElement("Box", 0, 0), id: "p", x: 96, w: 40, h: 40 }];
  const rect = { left: 50, top: 0, right: 90, bottom: 40 };
  const { dx, guides } = snapRectToPeers(rect, peers, new Set(), 8);
  assert.equal(dx, 6);
  assert.ok(guides.some((g) => g.axis === "x" && g.at === 96));
});

test("snapDelta respects grid", () => {
  assert.deepEqual(snapDelta(7, 9, 10), { dx: 10, dy: 10 });
  assert.deepEqual(snapDelta(7, 9, null), { dx: 7, dy: 9 });
});

test("nudge step sizes", () => {
  assert.equal(nudgeStep(false), 1);
  assert.equal(nudgeStep(true), 10);
  assert.deepEqual(arrowNudge("ArrowLeft", 10), { dx: -10, dy: 0 });
});

test("distance lines between separated boxes", () => {
  const a = { ...defaultElement("Box", 0, 0), id: "a", w: 40, h: 40 };
  const b = { ...defaultElement("Box", 0, 0), id: "b", x: 60, w: 40, h: 40 };
  const lines = distanceLinesFor(a, [b]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.gap, 20);
});

test("zoom helpers clamp", () => {
  assert.equal(zoomIn(1), 1.1);
  assert.equal(zoomOut(0.15), 0.1);
  assert.ok(zoomToFit(1000, 800, 500, 400) < 1);
  const bounds = { left: 0, top: 0, right: 200, bottom: 100 };
  assert.ok(zoomToBounds(bounds, 400, 300) > 1);
});

test("grid step toggle", () => {
  assert.equal(gridStep(true), 10);
  assert.equal(gridStep(false), 8);
});

test("drawRect shift square down-right", () => {
  const box = drawRect(100, 100, 150, 180, "Box", { shift: true, alt: false });
  assert.equal(box.x, 100);
  assert.equal(box.y, 100);
  assert.equal(box.w, 80);
  assert.equal(box.h, 80);
});

test("drawRect shift square up-left", () => {
  const box = drawRect(100, 100, 50, 30, "Ellipse", { shift: true, alt: false });
  assert.equal(box.x, 30);
  assert.equal(box.y, 30);
  assert.equal(box.w, 70);
  assert.equal(box.h, 70);
});

test("drawRect alt from center", () => {
  const box = drawRect(100, 100, 120, 110, "Box", { shift: false, alt: true });
  assert.equal(box.x, 80);
  assert.equal(box.y, 90);
  assert.equal(box.w, 40);
  assert.equal(box.h, 20);
});

test("drawRect shift and alt circle", () => {
  const box = drawRect(100, 100, 120, 110, "Ellipse", { shift: true, alt: true });
  assert.equal(box.w, box.h);
  assert.equal(box.x, 80);
  assert.equal(box.y, 80);
});

test("snapAngle locks line to 45 degrees", () => {
  const end = snapAngle(0, 0, 100, 100, true);
  assert.ok(Math.abs(end.x - end.y) < 0.01);
  assert.ok(end.x > 0);
});

test("constrainMove axis lock", () => {
  assert.deepEqual(constrainMove(12, 3, true), { dx: 12, dy: 0 });
  assert.deepEqual(constrainMove(3, 12, true), { dx: 0, dy: 12 });
});

test("resizeBox shift keeps aspect on corner", () => {
  const orig = { x: 0, y: 0, w: 100, h: 50 };
  const box = resizeBox(orig, "se", 200, 200, { shift: true, alt: false }, { type: "Box" });
  assert.ok(Math.abs(box.w / box.h - 2) < 0.01);
});

test("resizeBox alt from center", () => {
  const orig = { x: 40, y: 40, w: 20, h: 20 };
  const box = resizeBox(orig, "e", 70, 50, { shift: false, alt: true }, { type: "Box" });
  assert.equal(box.x, 30);
  assert.equal(box.w, 40);
});

test("resizeBox lockAspect without shift", () => {
  const orig = { x: 0, y: 0, w: 100, h: 50 };
  const box = resizeBox(orig, "e", 200, 80, { shift: false, alt: false }, { type: "Box", props: { lockAspect: true } });
  assert.ok(Math.abs(box.w / box.h - 2) < 0.01);
});

test("click drag threshold", () => {
  assert.equal(CLICK_DRAG_THRESHOLD, 4);
});
