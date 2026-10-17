import assert from "node:assert/strict";
import { test } from "node:test";
import { buildScreenshotGeneratePrompt, buildTextGeneratePrompt, slugWireframeStem } from "./agent-prompts.ts";

test("text prompt includes schema and target paths", () => {
  const prompt = buildTextGeneratePrompt({
    description: "Login form",
    device: "desktop",
    fidelity: "medium",
    schemaAbsPath: "/thread/Prototypes/WIREFRAME_SCHEMA.md",
    wireframeAbsPath: "/thread/Prototypes/login.wireframe.json",
  });
  assert.match(prompt, /WIREFRAME_SCHEMA\.md/);
  assert.match(prompt, /login\.wireframe\.json/);
  assert.match(prompt, /Login form/);
});

test("screenshot prompt references ref image path", () => {
  const prompt = buildScreenshotGeneratePrompt({
    description: "",
    schemaAbsPath: "/s.md",
    wireframeAbsPath: "/out.wireframe.json",
    refAbsPath: "/thread/Prototypes/refs/shot.png",
  });
  assert.match(prompt, /refs\/shot\.png/);
  assert.match(prompt, /out\.wireframe\.json/);
});

test("slugWireframeStem sanitizes description", () => {
  assert.equal(slugWireframeStem("  Hello World!!  "), "hello-world");
  assert.equal(slugWireframeStem("   "), "screen");
});
