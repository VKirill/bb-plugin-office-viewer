import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { buildWireframeCodeExport, isFormSemanticTag } from "./code-export.ts";
import { defaultElement, getActivePage, newWireframe } from "./model.ts";

test("code export emits parseable TSX with semantic form tags", () => {
  const doc = newWireframe("Login");
  const page = getActivePage(doc);
  const button = defaultElement("Button", 16, 24);
  const field = defaultElement("TextField", 16, 72);
  page.elements.push(button, field);
  const { files, readme } = buildWireframeCodeExport(doc);
  assert.ok(readme.includes("Page.tsx"));
  const login = files.find((file) => file.fileName.endsWith("Page.tsx"));
  assert.ok(login);
  assert.match(login!.content, /<button\b/);
  assert.match(login!.content, /<input\b/);
  const transpiled = ts.transpileModule(login!.content, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
    fileName: login!.fileName,
  });
  assert.equal(transpiled.diagnostics?.length ?? 0, 0);
  assert.equal(isFormSemanticTag("Button"), true);
  assert.equal(isFormSemanticTag("Box"), false);
});
