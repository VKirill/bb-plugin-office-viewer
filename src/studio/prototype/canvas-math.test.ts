import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement } from "./model.ts";
import {
  arrowNudge,
  clickSelection,
  distanceLinesFor,
  expandToGroups,
  gridStep,
  groupIds,
  marqueeHitTest,
  nudgeStep,
  normalizeRect,
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
