import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_WIREFRAME_HISTORY, pruneWireframeHistory } from "../../server/wireframe-history.ts";
import { benchSnapOnPerfPage, buildPerfPage, PERF_FIXTURE_ELEMENT_COUNT, perfFixtureUsesSpatialIndex } from "./perf-fixture.ts";

test("perf fixture builds requested element count", () => {
  const page = buildPerfPage(PERF_FIXTURE_ELEMENT_COUNT);
  assert.equal(page.elements.length, PERF_FIXTURE_ELEMENT_COUNT);
});

test("wireframe history pruning keeps last 50 snapshots", () => {
  const entries = Array.from({ length: 55 }, (_, i) => ({ id: `s${i}`, createdAt: i, reason: "save" as const }));
  assert.equal(pruneWireframeHistory(entries).length, MAX_WIREFRAME_HISTORY);
});

test("indexed snap is faster than naive on 500 elements", () => {
  assert.ok(perfFixtureUsesSpatialIndex(PERF_FIXTURE_ELEMENT_COUNT));
  const bench = benchSnapOnPerfPage(PERF_FIXTURE_ELEMENT_COUNT, 8);
  assert.ok(bench.indexedMs < bench.naiveMs, `indexed ${bench.indexedMs}ms vs naive ${bench.naiveMs}ms`);
  assert.ok(bench.speedup > 1.2, `speedup ${bench.speedup}`);
});
