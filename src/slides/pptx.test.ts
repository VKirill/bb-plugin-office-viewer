import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parsePptx, slideMarkdown, type Deck, type Shape } from "./pptx.ts";
import { arrowhead, outline } from "./pptx-geometry.ts";
import { numberLabel } from "./pptx-text.ts";
import { parseXml } from "./xml.ts";
import { formatBlockquote } from "../shared/quote.ts";

// fixtures/deck.pptx: a python-pptx deck of six 16:9 slides (title, bullets with notes, picture, table, shapes, chart).
const deck: Deck = parsePptx(new Uint8Array(readFileSync(new URL("../../fixtures/deck.pptx", import.meta.url))));

test("parseXml keeps prefixes, entities, CDATA and self-closing tags", () => {
  const root = parseXml('<?xml version="1.0"?><a:r x="1 &amp; 2"><a:t>5 &lt; 6 &#x41;</a:t><a:br/><![CDATA[<raw>]]></a:r>');
  assert.equal(root.name, "a:r");
  assert.equal(root.attrs.x, "1 & 2");
  assert.equal(root.kids[0].text, "5 < 6 A");
  assert.equal(root.kids[1].name, "a:br");
  assert.equal(root.text, "<raw>");
});

test("reads the slide size, titles and speaker notes", () => {
  assert.equal(deck.slides.length, 6);
  assert.equal(Math.round(deck.width), 1280);
  assert.equal(deck.height, 720);
  assert.deepEqual(deck.slides.map((slide) => slide.title), ["Quarterly Review", "Highlights", "A picture", "Table", "", "Chart"]);
  assert.equal(deck.slides[0].notes, "Welcome everyone. Start with the headline numbers.");
  assert.equal(deck.slides[1].notes, "Explain the enterprise driver.\nMention SMB is flat-ish.");
  assert.equal(deck.slides[2].notes, "");
});

test("slide text becomes Markdown with nested bullets and tables", () => {
  assert.equal(
    slideMarkdown(deck.slides[1]),
    ["**Highlights**", "", "- Revenue grew 24% year over year", "  - Enterprise: +31%", "  - SMB: +12%", "- Churn dropped to 2.1%", "- Привет, мир: кириллица работает"].join("\n"),
  );
  assert.equal(slideMarkdown(deck.slides[3]), ["**Table**", "", "| Region | Q1 | Q2 |", "|---|---|---|", "| EMEA | 120 | 140 |", "| APAC | 90 | 110 |", "| Americas | 200 | 230 |"].join("\n"));
});

test("placeholders inherit their size, bullets and fonts from the layout and master", () => {
  const body = deck.slides[1].shapes.find((shape) => shape.kind === "shape" && shape.body?.paras.length === 5);
  assert.ok(body && body.kind === "shape" && body.body);
  const [first, second] = body.body.paras;
  assert.equal(first.bullet?.text, "•");
  assert.equal(second.level, 1);
  assert.equal(second.bullet?.text, "–");
  assert.ok(Number(second.css.paddingLeft) > Number(first.css.paddingLeft));
  assert.ok(Number(first.css.fontSize) > Number(second.css.fontSize));
});

test("shapes carry fills, outlines and geometry; pictures, tables and charts are kinds of their own", () => {
  const kinds = (index: number) => deck.slides[index].shapes.map((shape: Shape) => shape.kind);
  assert.ok(kinds(2).includes("pic"));
  assert.ok(kinds(3).includes("table"));
  const chart = deck.slides[5].shapes.find((shape) => shape.kind === "unsupported");
  assert.equal(chart?.kind === "unsupported" ? chart.label : "", "chart");
  const rectangle = deck.slides[4].shapes[0];
  assert.ok(rectangle.kind === "shape");
  assert.deepEqual(rectangle.fill, { kind: "solid", color: "#2e75b6" });
  assert.equal(rectangle.geometry && "prst" in rectangle.geometry ? rectangle.geometry.prst : "", "rect");
});

test("the built-in table style colors header and banded rows", () => {
  const table = deck.slides[3].shapes.find((shape) => shape.kind === "table");
  assert.ok(table && table.kind === "table");
  const [header, firstRow, secondRow] = table.rows;
  assert.ok(String(header.cells[0].css.background).startsWith("#"));
  assert.notEqual(firstRow.cells[0].css.background, secondRow.cells[0].css.background);
  assert.equal(header.cells[0].body.paras[0].runs[0].css.fontWeight, 700);
});

test("preset outlines scale to the box", () => {
  assert.equal(outline({ prst: "rect", adj: {} }, 100, 50).d, "M0 0H100V50H0Z");
  assert.ok(outline({ prst: "roundRect", adj: { adj: 50000 } }, 100, 50).d.includes("A25 25"));
  assert.equal(outline({ prst: "star5", adj: {} }, 100, 100).d.split("L").length, 10);
  assert.deepEqual(outline({ prst: "straightConnector1", adj: {} }, 30, 40).end, { x: 30, y: 40, angle: Math.atan2(40, 30) });
  assert.equal(outline({ prst: "unknownShape", adj: {} }, 10, 10).rect, true);
  assert.ok(arrowhead({ x: 10, y: 0 }, 0, 6).startsWith("M10 0L"));
});

test("custom paths scale from their own coordinate space and keep arcs", () => {
  const cust = parseXml(
    '<a:custGeom><a:pathLst><a:path w="100" h="50"><a:moveTo><a:pt x="0" y="50"/></a:moveTo><a:arcTo wR="50" hR="50" stAng="10800000" swAng="10800000"/><a:lnTo><a:pt x="100" y="0"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>',
  );
  assert.equal(outline({ cust }, 200, 100).d, "M0 100A100 100 0 0 1 200 100L200 0Z");
});

test("auto-numbered bullets", () => {
  assert.equal(numberLabel("arabicPeriod", 3), "3.");
  assert.equal(numberLabel("alphaLcParenR", 2), "b)");
  assert.equal(numberLabel("romanUcPeriod", 4), "IV.");
  assert.equal(numberLabel("arabicParenBoth", 7), "(7)");
});

test("a chat quote names the file and quotes the text line by line", () => {
  assert.equal(formatBlockquote({ path: "/a/b.docx", host: "mini", text: "One\n\nTwo " }), "`/a/b.docx` · mini\n\n> One\n>\n> Two");
  assert.equal(formatBlockquote({ path: "/a/d.pptx", host: "mini", where: "slide 3", text: "x" }), "`/a/d.pptx` · slide 3 · mini\n\n> x");
});
