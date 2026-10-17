import assert from "node:assert/strict";
import { test } from "node:test";
import { studioToolOf } from "./studio-tool.ts";

test("studioToolOf maps prototype, paint and slides", () => {
  assert.equal(studioToolOf({ tool: "prototype" }), "prototype");
  assert.equal(studioToolOf({ tool: "paint" }), "paint");
  assert.equal(studioToolOf({ tool: "slides" }), "slides");
});

test("studioToolOf is null without a known tool", () => {
  assert.equal(studioToolOf(null), null);
  assert.equal(studioToolOf(undefined), null);
  assert.equal(studioToolOf("paint"), null);
  assert.equal(studioToolOf(["paint"]), null);
  assert.equal(studioToolOf({}), null);
  assert.equal(studioToolOf({ tool: "other" }), null);
  assert.equal(studioToolOf({ tool: ["paint"] }), null);
});
