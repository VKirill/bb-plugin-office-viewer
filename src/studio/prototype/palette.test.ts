import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG_BY_TYPE, ELEMENT_TYPES, newWireframe, parseWireframe } from "./model.ts";
import { PALETTE_TILES, elementFromTile, tileGroup, tileMatchesQuery } from "./palette.ts";

test("every palette entry builds a valid element and parses", () => {
  const doc = newWireframe("Palette");
  for (const tile of PALETTE_TILES) {
    const el = elementFromTile(tile, 0, 0, doc.elements);
    assert.equal(el.type, tile.type);
    for (const [key, value] of Object.entries(tile.props)) assert.deepEqual(el.props[key], value);
    doc.elements.push(el);
  }
  const again = parseWireframe(JSON.stringify(doc));
  assert.equal(again.elements.length, PALETTE_TILES.length);
});

test("palette tiles use only existing types and cover every type", () => {
  const types = new Set(PALETTE_TILES.map((tile) => tile.type));
  for (const tile of PALETTE_TILES) {
    assert.ok(ELEMENT_TYPES.includes(tile.type), tile.id);
    assert.equal(tileGroup(tile), CATALOG_BY_TYPE[tile.type].group);
  }
  for (const type of ELEMENT_TYPES) assert.ok(types.has(type), type);
});

test("variants create existing types with their props", () => {
  const primary = elementFromTile(PALETTE_TILES.find((tile) => tile.id === "button-primary")!, 0, 0);
  assert.equal(primary.type, "Button");
  assert.equal(primary.props.variant, "default");
  const link = elementFromTile(PALETTE_TILES.find((tile) => tile.id === "button-link")!, 0, 0);
  assert.equal(link.type, "Button");
  assert.equal(link.props.variant, "link");
  const h2 = elementFromTile(PALETTE_TILES.find((tile) => tile.id === "heading-2")!, 0, 0);
  assert.equal(h2.type, "Heading");
  assert.equal(h2.props.level, 2);
  const h3 = elementFromTile(PALETTE_TILES.find((tile) => tile.id === "heading-3")!, 8, 8);
  assert.equal(h3.type, "Heading");
  assert.equal(h3.props.level, 3);
});

test("search matches type, id and display name", () => {
  const heading = PALETTE_TILES.find((tile) => tile.id === "heading-1")!;
  assert.equal(tileMatchesQuery(heading, "", "Heading 1"), true);
  assert.equal(tileMatchesQuery(heading, "head", "Heading 1"), true);
  assert.equal(tileMatchesQuery(heading, "заголовок", "Заголовок 1"), true);
  assert.equal(tileMatchesQuery(heading, "button", "Heading 1"), false);
  const link = PALETTE_TILES.find((tile) => tile.id === "button-link")!;
  assert.equal(tileMatchesQuery(link, "link", "Link button"), true);
  assert.equal(tileMatchesQuery(link, "Button", "Кнопка-ссылка"), true);
});
