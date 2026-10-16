import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeHtml, insideSite, normalizeAddress, prepareHtml, SCREENSHOT_LIBRARY } from "./capture.ts";

const BASE = "http://bb.local/api/v1/file-previews/abc/";

test("the agent and a <base> go right after <head>, before anything that loads", () => {
  const out = prepareHtml('<!doctype html><html lang="ru"><head><link rel="stylesheet" href="style.css"></head><body></body></html>', BASE);
  const head = out.indexOf("<head>") + "<head>".length;
  assert.equal(out.indexOf(`<base href="${BASE}">`), head);
  assert.ok(out.indexOf(SCREENSHOT_LIBRARY) < out.indexOf("style.css"));
});

test("a page with its own <base> keeps it; fragments without <head> still get the agent", () => {
  assert.ok(!prepareHtml('<html><head><base href="/x/"></head></html>', BASE).includes(`<base href="${BASE}">`));
  assert.ok(prepareHtml("<p>hi</p>", BASE).startsWith(`<base href="${BASE}">`));
  assert.ok(prepareHtml("<HTML><body>x</body></HTML>", BASE).startsWith("<HTML><base"));
});

test("the declared charset decodes the page", () => {
  const cp1251 = new Uint8Array([...new TextEncoder().encode('<meta charset="windows-1251"><p>'), 0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
  assert.ok(decodeHtml(cp1251).endsWith("Привет"));
  assert.equal(decodeHtml(new TextEncoder().encode("<p>Привет")), "<p>Привет");
  // The header wins over a missing or different meta.
  assert.ok(decodeHtml(new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]), "text/html; charset=windows-1251").endsWith("Привет"));
});

test("only the site's own folder is readable for the page", () => {
  assert.equal(insideSite(`${BASE}img/a.png`, BASE), true);
  assert.equal(insideSite("img/a.png", BASE), true);
  assert.equal(insideSite("http://bb.local/api/v1/threads", BASE), false);
  assert.equal(insideSite(`${BASE}../other/`, BASE), false);
  assert.equal(insideSite("https://fonts.example/a.woff2", BASE), false);
});

test("the agent survives being embedded: it parses and its patterns keep their escapes", () => {
  const code = /<script>([\s\S]*)<\/script>/.exec(prepareHtml("<html><head></head></html>", BASE))![1]!;
  assert.doesNotThrow(() => new Function(code));
  for (const pattern of ['url\\(["', "\\.(woff2?", "\\.css(\\?", "@font-face\\s*{"]) assert.ok(code.includes(pattern), pattern);
});

test("typed addresses: a missing scheme becomes https, other schemes and junk are refused", () => {
  assert.equal(normalizeAddress(" selfystudio.art/demo "), "https://selfystudio.art/demo");
  assert.equal(normalizeAddress("http://example.com"), "http://example.com/");
  assert.equal(normalizeAddress("ftp://example.com"), null);
  assert.equal(normalizeAddress("javascript:alert(1)"), null);
  assert.equal(normalizeAddress(""), null);
});

test("the library is loaded from BB even when <base> points at another site", () => {
  const out = prepareHtml("<html><head></head></html>", "https://example.com/page.html", "http://bb.local/api/v1/plugins/office-viewer/http/capture/modern-screenshot.js");
  assert.ok(out.includes('<script src="http://bb.local/api/v1/plugins/office-viewer/http/capture/modern-screenshot.js">'));
});
