import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendHistoryEntry,
  MAX_WIREFRAME_HISTORY,
  pruneWireframeHistory,
  type WireframeHistoryEntry,
} from "./wireframe-history.ts";

function entry(id: string, createdAt: number): WireframeHistoryEntry {
  return { id, createdAt, reason: "save" };
}

test("pruneWireframeHistory keeps newest entries up to max", () => {
  const entries = Array.from({ length: 60 }, (_, i) => entry(`s${i}`, i));
  const pruned = pruneWireframeHistory(entries);
  assert.equal(pruned.length, MAX_WIREFRAME_HISTORY);
  assert.equal(pruned[0]!.id, "s59");
  assert.equal(pruned[MAX_WIREFRAME_HISTORY - 1]!.id, "s10");
});

test("appendHistoryEntry prepends and prunes", () => {
  const base = { stem: "Board", entries: [entry("a", 1), entry("b", 2)] };
  const next = appendHistoryEntry(base, entry("c", 3));
  assert.equal(next.entries[0]!.id, "c");
  assert.equal(next.entries.length, 3);
});
