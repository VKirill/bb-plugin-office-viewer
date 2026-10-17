import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatHex, hexToHsl, hslToHex, normalizeColourInput, parseColour } from "./inspector-colour.ts";

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
