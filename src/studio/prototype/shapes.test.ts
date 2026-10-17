import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FLOW_SHAPES, shapePath } from "./shapes.ts";

describe("shapePath", () => {
  for (const shape of FLOW_SHAPES) {
    it(`returns a non-empty path for ${shape}`, () => {
      const path = shapePath(shape, 100, 60);
      assert.ok(path.length > 0);
      assert.match(path, /M|m/);
    });
  }
});
