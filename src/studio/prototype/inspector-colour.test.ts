import assert from "node:assert/strict";
import { describe, it, test } from "node:test";
import {
  collectDocumentColours,
  colourIsNone,
  formatHex,
  hexToHsl,
  hslToHex,
  normalizeColourInput,
  parseColour,
  parseRgbChannels,
  resolvePickerColour,
} from "./inspector-colour.ts";
import { defaultElement } from "./model.ts";

describe("parseColour", () => {
  it("parses short and long hex", () => {
    assert.deepEqual(parseColour("#fff"), { r: 255, g: 255, b: 255, a: 1 });
    assert.deepEqual(parseColour("#336699"), { r: 51, g: 102, b: 153, a: 1 });
  });

  it("parses rgba and transparent", () => {
    assert.equal(parseColour("transparent")?.a, 0);
    const rgba = parseColour("rgba(10, 20, 30, 0.5)");
    assert.equal(rgba?.r, 10);
    assert.equal(rgba?.a, 0.5);
  });
});

describe("hsl round trip", () => {
  it("converts hex to hsl and back", () => {
    const hsl = hexToHsl("#3b82f6");
    const again = hslToHex(hsl.h, hsl.s, hsl.l);
    assert.equal(again.toLowerCase(), "#3b82f6");
  });
});

describe("normalizeColourInput", () => {
  it("formats parsed colours", () => {
    assert.equal(normalizeColourInput("#ffffff"), "#FFFFFF");
    assert.equal(formatHex({ r: 0, g: 0, b: 0, a: 0.5 }, true).length, 9);
  });
});

test("resolvePickerColour uses fallback when unset", () => {
  const rgba = resolvePickerColour(undefined, "#336699");
  assert.equal(rgba.b, 153);
  assert.equal(colourIsNone("transparent"), true);
  assert.equal(colourIsNone(undefined), false);
});

test("parseRgbChannels round-trips", () => {
  const rgba = parseRgbChannels("10, 20, 30", 1);
  assert.deepEqual(rgba, { r: 10, g: 20, b: 30, a: 1 });
});

test("collectDocumentColours gathers canvas and element styles", () => {
  const el = defaultElement("Box", 0, 0);
  const styled = { ...el, style: { base: { fill: "#ff0000", stroke: "#00ff00" } } };
  const colours = collectDocumentColours({ width: 100, height: 100, background: "#ffffff" }, [styled]);
  assert.ok(colours.includes("#FFFFFF"));
  assert.ok(colours.includes("#FF0000"));
  assert.ok(colours.includes("#00FF00"));
});
