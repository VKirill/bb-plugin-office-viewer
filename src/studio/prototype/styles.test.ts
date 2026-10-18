import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement, newWireframe } from "./model.ts";
import {
  applyColorTokenLink,
  applyTextStyleLink,
  linkedStylePatch,
  mergeDesignImport,
  newColorToken,
  newTextStyle,
  parseDesignMarkdown,
  rankCommandPaletteItems,
  resolveStylePatchWithLibrary,
  updateColorTokenInLibrary,
} from "./styles.ts";

const FIXTURE_DESIGN = `
# Design tokens

--primary: #3366ff
--surface: #f8fafc

primary: #112233
body: 16 / 1.5
h1: 32
`;

test("parseDesignMarkdown extracts css variables and type scale", () => {
  const parsed = parseDesignMarkdown(FIXTURE_DESIGN);
  assert.ok(parsed.colors.some((item) => item.name === "primary" && item.value === "#3366ff"));
  assert.ok(parsed.colors.some((item) => item.name === "surface"));
  assert.ok(parsed.text.some((item) => item.name === "body" && item.fontSize === 16));
  assert.ok(parsed.text.some((item) => item.name === "h1" && item.fontSize === 32));
});

test("linked colour token propagates to style patch", () => {
  const library = { colors: [newColorToken("brand", "#ff00aa")], text: [] };
  const el = applyColorTokenLink(defaultElement("Button", 0, 0), library.colors[0]!.id);
  const patch = linkedStylePatch(el, library);
  assert.equal(patch.fill, "#ff00aa");
  assert.equal(patch.color, "#ff00aa");
});

test("editing a token updates resolved patch for linked elements", () => {
  const library = { colors: [newColorToken("brand", "#111111")], text: [] };
  const tokenId = library.colors[0]!.id;
  const el = applyColorTokenLink(defaultElement("Box", 0, 0), tokenId);
  const updated = updateColorTokenInLibrary(library, tokenId, { value: "#222222" });
  const patch = linkedStylePatch(el, updated);
  assert.equal(patch.fill, "#222222");
});

test("text style link merges with local style patch", () => {
  const library = {
    colors: [],
    text: [newTextStyle("Title", { fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: "#111" })],
  };
  const el = applyTextStyleLink(defaultElement("Heading", 0, 0), library.text[0]!.id);
  const merged = resolveStylePatchWithLibrary(el, { fontSize: 18 }, library);
  assert.equal(merged.fontSize, 18);
  assert.equal(merged.fontWeight, 700);
});

test("mergeDesignImport upserts by name", () => {
  const base = { colors: [newColorToken("primary", "#000")], text: [] };
  const imported = parseDesignMarkdown("--primary: #abc");
  const next = mergeDesignImport(base, imported);
  assert.equal(next.colors.find((item) => item.name === "primary")?.value, "#abc");
});

test("command palette search ranking prefers exact label match", () => {
  const items = [
    { id: "a", group: "action" as const, label: "Align left", keywords: "align" },
    { id: "b", group: "action" as const, label: "Preview", keywords: "open preview" },
    { id: "c", group: "element" as const, label: "Button 1", detail: "Button" },
  ];
  const ranked = rankCommandPaletteItems("preview", items);
  assert.equal(ranked[0]?.id, "b");
  const align = rankCommandPaletteItems("align", items);
  assert.equal(align[0]?.id, "a");
});

test("wireframe without styleLibrary still parses", () => {
  const doc = newWireframe("Clean");
  assert.equal(doc.styleLibrary, undefined);
});
