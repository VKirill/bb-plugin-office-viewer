import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ELEMENT_TYPES, WIREFRAME_FORMAT, WIREFRAME_VERSION, newWireframe, parseWireframe } from "./model.ts";

const schema = JSON.parse(readFileSync(join(import.meta.dirname, "wireframe.schema.json"), "utf8")) as {
  properties: {
    format: { const: string };
    version: { const: number };
    pages: { items: { properties: { elements: { items: { properties: { type: { enum: string[] } } } } } } };
  };
};

test("wireframe.schema.json matches zod element types and version", () => {
  const elementEnum = schema.properties.pages.items.properties.elements.items.properties.type.enum;
  assert.deepEqual([...elementEnum].sort(), [...ELEMENT_TYPES].sort());
  assert.equal(schema.properties.format.const, WIREFRAME_FORMAT);
  assert.equal(schema.properties.version.const, WIREFRAME_VERSION);
});

test("minimal and rich fixtures pass parseWireframe", () => {
  const minimal = newWireframe("Login");
  parseWireframe(JSON.stringify(minimal));
  const md = readFileSync(join(import.meta.dirname, "WIREFRAME_SCHEMA.md"), "utf8");
  const match = md.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(match);
  parseWireframe(match[1]!);
});
