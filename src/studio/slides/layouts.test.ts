import assert from "node:assert/strict";
import { test } from "node:test";
import { LAYOUT_IDS, layoutElements, slideFromLayout } from "./layouts.ts";
import { defaultTheme, parseSlidesDeck, SLIDE_HEIGHT, SLIDE_WIDTH } from "./model.ts";

test("layout presets produce valid slide elements", () => {
  const theme = defaultTheme();
  for (const layout of LAYOUT_IDS) {
    const elements = layoutElements(layout, theme);
    assert.ok(elements.length >= 0);
    for (const el of elements) {
      assert.ok(el.x >= 0 && el.y >= 0);
      assert.ok(el.x + el.w <= SLIDE_WIDTH + 8);
      assert.ok(el.y + el.h <= SLIDE_HEIGHT + 8);
    }
    const slide = slideFromLayout(layout, theme, "Test");
    const deck = parseSlidesDeck({
      format: "bb-slides",
      version: 1,
      name: "Deck",
      theme,
      slides: [slide],
      activeSlideId: slide.id,
    });
    assert.equal(deck.slides[0]!.layout, layout);
  }
});
