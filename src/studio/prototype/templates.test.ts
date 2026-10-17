import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWireframe } from "./model.ts";
import {
  FORM_TEMPLATES,
  INTERFACE_TEMPLATES,
  TEMPLATE_LIST,
  filterTemplates,
  insertTemplateElements,
  previewElementsForTemplate,
} from "./templates.ts";

describe("template catalog", () => {
  it("has at least 12 form and 14 interface templates", () => {
    assert.ok(FORM_TEMPLATES.length >= 12);
    assert.ok(INTERFACE_TEMPLATES.length >= 14);
  });

  it("every template builds valid grouped elements", () => {
    for (const template of TEMPLATE_LIST) {
      const built = insertTemplateElements(template.id, 200, 200, []);
      assert.ok(built && built.length > 1, template.id);
      const groupId = built![0].groupId;
      assert.ok(groupId);
      assert.ok(built!.every((el) => el.groupId === groupId));
      const json = JSON.stringify({
        format: "bb-wireframe",
        version: 2,
        name: "t",
        activePageId: "p1",
        pages: [{ id: "p1", name: "Page 1", canvas: { width: 1280, height: 800, background: "#fff" }, elements: built }],
      });
      parseWireframe(json);
    }
  });
});

describe("filterTemplates", () => {
  it("finds templates by Russian keyword", () => {
    const hits = filterTemplates(TEMPLATE_LIST, "оформление", () => "");
    assert.ok(hits.some((item) => item.id === "tpl-checkout"));
  });

  it("finds templates by id fragment", () => {
    const hits = filterTemplates(TEMPLATE_LIST, "pricing", () => "");
    assert.ok(hits.some((item) => item.id === "tpl-pricing"));
  });
});

describe("previewElementsForTemplate", () => {
  it("returns elements for library thumbnails", () => {
    const preview = previewElementsForTemplate("tpl-login");
    assert.ok(preview.length > 0);
  });
});
