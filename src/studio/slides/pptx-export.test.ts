import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement } from "../prototype/model.ts";
import { mapElementToPptx, mapSlideToPptxDescriptors } from "./pptx-export.ts";
import { newSlide, defaultTheme } from "./model.ts";

test("mapElementToPptx covers common element kinds", () => {
  const base = defaultElement("Text", 40, 40, []);
  const heading = { ...defaultElement("Heading", 40, 40, []), props: { text: "Hi", level: 1 } };
  const box = defaultElement("Box", 80, 80, []);
  const table = {
    ...defaultElement("Table", 100, 100, []),
    props: { rows: [["A", "B"], ["1", "2"]] },
  };
  const list = { ...defaultElement("List", 120, 120, []), props: { items: ["One", "Two"] } };
  const icon = { ...defaultElement("Icon", 140, 140, []), props: { name: "HomeIcon", size: 24, color: "foreground" } };

  assert.equal(mapElementToPptx({ ...base, props: { text: "Body" } }).kind, "text");
  assert.equal(mapElementToPptx(heading).kind, "text");
  assert.equal(mapElementToPptx(box).kind, "shape");
  assert.equal(mapElementToPptx(table).kind, "table");
  assert.equal(mapElementToPptx(list).kind, "text");
  assert.equal(mapElementToPptx(icon).kind, "text");
});

test("mapSlideToPptxDescriptors returns one entry per visible element", () => {
  const slide = newSlide("blank", defaultTheme());
  slide.elements = [defaultElement("Text", 0, 0, []), defaultElement("Box", 100, 100, [])];
  const mapped = mapSlideToPptxDescriptors(slide);
  assert.equal(mapped.length, 2);
});
