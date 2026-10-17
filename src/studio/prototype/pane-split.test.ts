import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_LEFT_PANE_SPLIT,
  LEFT_PANE_DIVIDER_SIZE,
  LEFT_PANE_MIN_SECTION,
  adjustSplitByKeyboard,
  parseLeftPaneSplit,
  resolveLeftPaneHeights,
  togglePagesCollapsed,
  topRatioFromHeight,
} from "./pane-split.ts";

describe("parseLeftPaneSplit", () => {
  it("returns defaults for bad input", () => {
    assert.deepEqual(parseLeftPaneSplit(null), DEFAULT_LEFT_PANE_SPLIT);
    assert.deepEqual(parseLeftPaneSplit("{"), DEFAULT_LEFT_PANE_SPLIT);
  });

  it("round-trips persisted fields", () => {
    const parsed = parseLeftPaneSplit(JSON.stringify({ topRatio: 0.55, pagesCollapsed: true, librariesCollapsed: false }));
    assert.equal(parsed.topRatio, 0.55);
    assert.equal(parsed.pagesCollapsed, true);
    assert.equal(parsed.librariesCollapsed, false);
  });
});

describe("resolveLeftPaneHeights", () => {
  const total = 400;

  it("enforces minimum section sizes when expanded", () => {
    const { top, bottom } = resolveLeftPaneHeights(total, DEFAULT_LEFT_PANE_SPLIT);
    assert.ok(top >= LEFT_PANE_MIN_SECTION);
    assert.ok(bottom >= LEFT_PANE_MIN_SECTION);
    assert.equal(top + bottom + LEFT_PANE_DIVIDER_SIZE, total);
  });

  it("collapses pages to header height", () => {
    const state = togglePagesCollapsed(DEFAULT_LEFT_PANE_SPLIT);
    const { top } = resolveLeftPaneHeights(total, state);
    assert.equal(top, 40);
  });

  it("keyboard nudge changes ratio within bounds", () => {
    const moved = adjustSplitByKeyboard(total, DEFAULT_LEFT_PANE_SPLIT, "ArrowDown");
    assert.ok(moved.topRatio > DEFAULT_LEFT_PANE_SPLIT.topRatio);
    const home = adjustSplitByKeyboard(total, moved, "Home");
    const { top } = resolveLeftPaneHeights(total, home);
    assert.equal(top, LEFT_PANE_MIN_SECTION);
  });
});

describe("topRatioFromHeight", () => {
  it("clamps extreme ratios", () => {
    const ratio = topRatioFromHeight(400, 10, DEFAULT_LEFT_PANE_SPLIT);
    assert.ok(ratio >= 0.15);
  });
});
