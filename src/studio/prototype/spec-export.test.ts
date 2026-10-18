import assert from "node:assert/strict";
import { test } from "node:test";
import { addComment } from "./comments.ts";
import { defaultElement, getActivePage, newWireframe, parseWireframe } from "./model.ts";
import { buildWireframeSpecMarkdown, specImageRelPath } from "./spec-export.ts";

test("spec markdown lists elements, comments, and image path", () => {
  let doc = newWireframe("Checkout");
  const page = getActivePage(doc);
  const button = defaultElement("Button", 16, 24);
  page.elements.push({ ...button, props: { ...button.props, text: "Pay" } });
  doc = addComment(doc, { pageId: page.id, x: 100, y: 100, elementId: button.id, text: "Match production" });
  const rel = specImageRelPath("checkout", page);
  const md = buildWireframeSpecMarkdown(doc, "checkout", [{ pageId: page.id, relPath: rel }]);
  assert.match(md, /# Checkout — wireframe specification/);
  assert.match(md, /Match production/);
  assert.match(md, /Button · Button/);
  assert.ok(md.includes(rel));
  parseWireframe(JSON.stringify(doc));
});
