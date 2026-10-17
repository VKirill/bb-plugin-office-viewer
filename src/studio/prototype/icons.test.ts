import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterIcons, iconDisplayLabel, iconSearchWords } from "./icons.ts";

describe("iconSearchWords", () => {
  it("splits CamelCase and strips Icon suffix", () => {
    assert.deepEqual(iconSearchWords("ArrowRight01Icon"), ["arrow", "right", "01"]);
    assert.equal(iconDisplayLabel("ArrowRight01Icon"), "arrow right 01");
  });

  it("handles registry-style names", () => {
    assert.deepEqual(iconSearchWords("Star"), ["star"]);
  });
});

describe("filterIcons", () => {
  const names = ["ArrowRight01Icon", "StarIcon", "Home09Icon"];

  it("returns all when query is empty", () => {
    assert.deepEqual(filterIcons(names, ""), names);
    assert.deepEqual(filterIcons(names, "   "), names);
  });

  it("filters by multiple terms", () => {
    assert.deepEqual(filterIcons(names, "arrow right"), ["ArrowRight01Icon"]);
    assert.deepEqual(filterIcons(names, "home"), ["Home09Icon"]);
  });

  it("matches export name substring", () => {
    assert.deepEqual(filterIcons(names, "star"), ["StarIcon"]);
  });
});
