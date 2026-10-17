import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPerfPage } from "./perf-fixture.ts";
import { ElementSpatialIndex } from "./spatial-index.ts";
import { elementRect } from "./canvas-math.ts";

test("spatial index query returns nearby elements only", () => {
  const page = buildPerfPage(120);
  const index = new ElementSpatialIndex(page.elements);
  const target = page.elements[0]!;
  const box = elementRect(target);
  const nearby = index.query(box, 64);
  assert.ok(nearby.length > 0);
  assert.ok(nearby.length < page.elements.length);
  assert.ok(nearby.some((el) => el.id === target.id));
});
