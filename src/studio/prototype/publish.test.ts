import assert from "node:assert/strict";
import { test } from "node:test";
import { addComment } from "./comments.ts";
import { defaultElement, getActivePage, newWireframe, parseWireframe } from "./model.ts";
import {
  buildPageSvg,
  buildPdfFromJpegPages,
  buildStaticPlayerHtml,
  collectPdfNotes,
  importExcalidrawJson,
  importFileText,
  importSvgMarkup,
  mergeImportOntoPage,
  pngExportFileName,
  prototypePreviewHttpPath,
  prototypePreviewUrl,
} from "./publish.ts";

test("preview URL is stable under plugin http prefix", () => {
  const path = prototypePreviewHttpPath("thr_1", "Checkout");
  assert.equal(path, "/prototype/preview/thr_1/Checkout/index.html");
  assert.equal(prototypePreviewUrl("thr_1", "Checkout", "https://bb.local"), "https://bb.local/api/v1/plugins/office-viewer/http/prototype/preview/thr_1/Checkout/index.html");
});

test("static player html embeds document name and pages", () => {
  const doc = newWireframe("Demo");
  const html = buildStaticPlayerHtml(doc);
  assert.match(html, /Demo/);
  assert.match(html, /"pages"/);
  assert.match(html, /<!DOCTYPE html>/);
});

test("svg export contains canvas and a button", () => {
  const doc = newWireframe("Screen");
  const page = getActivePage(doc);
  const button = defaultElement("Button", 40, 40, page.elements);
  page.elements.push({ ...button, props: { ...button.props, text: "Go" } });
  const svg = buildPageSvg(doc, page.id);
  assert.match(svg, /<svg/);
  assert.match(svg, /Go/);
});

test("pdf builder emits valid header and note page", () => {
  const jpeg = Uint8Array.from(
    Buffer.from(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAgMBAAAAAAAAAAAAAAAGBAUCAwABB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDcwA//2Q==",
      "base64",
    ),
  );
  const pdf = buildPdfFromJpegPages([{ widthPt: 100, heightPt: 80, jpeg }], [{ pageName: "Home", number: 1, text: "Check spacing" }]);
  const head = new TextDecoder().decode(pdf.slice(0, 8));
  assert.equal(head, "%PDF-1.4");
  const text = new TextDecoder().decode(pdf);
  assert.match(text, /Check spacing/);
});

test("collectPdfNotes gathers pins and element notes", () => {
  let doc = newWireframe("Notes");
  const page = getActivePage(doc);
  doc = addComment(doc, { pageId: page.id, x: 8, y: 8, text: "Pin me" });
  const notes = collectPdfNotes(doc, true);
  assert.ok(notes.some((item) => item.text === "Pin me"));
});

test("excalidraw import maps shapes to elements", () => {
  const raw = JSON.stringify({
    type: "excalidraw",
    elements: [
      { type: "rectangle", x: 10, y: 20, width: 100, height: 40, backgroundColor: "#eee" },
      { type: "text", x: 12, y: 24, width: 80, height: 24, text: "Hello" },
      { type: "ellipse", x: 200, y: 40, width: 60, height: 60 },
    ],
    appState: { width: 800, height: 600 },
  });
  const placement = importExcalidrawJson(raw);
  assert.equal(placement.elements.length, 3);
  assert.ok(placement.elements.some((el) => el.type === "Text" && el.props.text === "Hello"));
  let doc = mergeImportOntoPage(newWireframe("Import"), placement);
  parseWireframe(JSON.stringify(doc));
});

test("svg import reads rects and text", () => {
  const svg = `<svg width="400" height="300" viewBox="0 0 400 300"><rect x="10" y="10" width="80" height="40" fill="#ccc"/><text x="20" y="30">Hi</text></svg>`;
  const placement = importSvgMarkup(svg);
  assert.equal(placement.elements.length, 2);
  const merged = importFileText("layer.svg", svg);
  assert.equal(merged.elements.length, 2);
});

test("png export file name encodes device and scale", () => {
  const doc = newWireframe("App");
  const page = getActivePage(doc);
  assert.match(pngExportFileName("app", page, "phone", 2), /^app-.+-phone@2x\.png$/);
});
