import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { I18N_EN, I18N_RU, type I18nKey } from "../shared/i18n.ts";

const ROOT = join(import.meta.dirname);
const SKIP = new Set(["pictograms.tsx", "logos.tsx"]);
const ALLOW = /^(?:[\d.\s×x%pxPX:+\-~/°]+|H[123]|Aa|R|W|H|X|Y|N|B|I|U)$/;
const ATTR = /\b(?:title|aria-label|placeholder|label)=\{?"([^"{]*)"/g;
const TEXT = /(?<!=)>([A-Za-zА-Яа-яЁё][^<{]*)</g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".tsx") && !SKIP.has(entry.name)) out.push(path);
  }
  return out;
}

test("every i18n key has RU and EN values", () => {
  for (const key of Object.keys(I18N_EN) as I18nKey[]) {
    assert.equal(typeof I18N_EN[key], "string", key);
    assert.equal(typeof I18N_RU[key], "string", key);
    assert.ok(I18N_EN[key].length > 0, key);
    assert.ok(I18N_RU[key].length > 0, key);
  }
});

test("studio tsx has no hard-coded UI words", () => {
  const hits: string[] = [];
  for (const file of walk(ROOT)) {
    const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const rel = file.slice(ROOT.length + 1);
    for (const match of source.matchAll(ATTR)) {
      const text = match[1]!.trim();
      if (text && /[A-Za-zА-Яа-яЁё]/.test(text) && !ALLOW.test(text)) hits.push(`${rel} ${JSON.stringify(text)}`);
    }
    for (const match of source.matchAll(TEXT)) {
      const text = match[1]!.trim();
      if (text && /[A-Za-zА-Яа-яЁё]/.test(text) && !ALLOW.test(text)) hits.push(`${rel} ${JSON.stringify(text)}`);
    }
  }
  assert.deepEqual(hits, []);
});
