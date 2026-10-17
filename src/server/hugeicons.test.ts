import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HUGEICON_NAMES } from "../studio/prototype/hugeicons-names.ts";
import { filterHugeiconNames, loadHugeiconsByNames } from "./hugeicons.ts";

describe("filterHugeiconNames", () => {
  it("drops unknown and duplicate names", () => {
    assert.deepEqual(filterHugeiconNames(["StarIcon", "nope", "StarIcon", "Home09Icon"]), ["StarIcon", "Home09Icon"]);
  });

  it("caps batch size", () => {
    assert.equal(filterHugeiconNames(HUGEICON_NAMES.slice(0, 80)).length, 64);
  });
});

describe("loadHugeiconsByNames", () => {
  it("loads default export svg data", async () => {
    const icons = await loadHugeiconsByNames(["StarIcon"]);
    assert.ok(Array.isArray(icons.StarIcon));
    assert.equal(icons.StarIcon?.[0]?.[0], "path");
  });
});
