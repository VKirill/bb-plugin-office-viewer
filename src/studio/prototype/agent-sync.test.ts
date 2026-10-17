import assert from "node:assert/strict";
import { test } from "node:test";
import { newWireframe, parseWireframe, tryParseWireframe } from "./model.ts";
import {
  isOwnWireframeWrite,
  replaceWireframeFromRemote,
  shouldApplyRemoteWireframe,
  wireframeContentSha256,
} from "./agent-sync.ts";

test("wireframeContentSha256 is stable", async () => {
  const a = await wireframeContentSha256('{"a":1}');
  const b = await wireframeContentSha256('{"a":1}');
  const c = await wireframeContentSha256('{"a":2}');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("shouldApplyRemoteWireframe ignores own writes and duplicate remote", () => {
  assert.equal(shouldApplyRemoteWireframe("abc", "abc", null), false);
  assert.equal(shouldApplyRemoteWireframe("remote", "local", "remote"), false);
  assert.equal(shouldApplyRemoteWireframe("remote", "local", null), true);
  assert.equal(isOwnWireframeWrite("same", "same"), true);
});

test("invalid external JSON keeps current document", () => {
  const current = newWireframe("Keep");
  const bad = tryParseWireframe({ format: "bb-wireframe", version: 2, name: "X", pages: [], activePageId: "missing" });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    const still = replaceWireframeFromRemote(current, current);
    assert.deepEqual(still, current);
  }
});

test("valid external JSON replaces document", () => {
  const current = newWireframe("Old");
  const incoming = parseWireframe(JSON.stringify(newWireframe("New")));
  const merged = replaceWireframeFromRemote(current, incoming);
  assert.equal(merged.name, "New");
});
