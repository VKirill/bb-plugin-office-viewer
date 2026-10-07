import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCsvEdits, parseCsv, serializeCsv } from "./csv.ts";

const utf8 = (text: string) => new TextEncoder().encode(text);
const read = (bytes: Uint8Array) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

test("unchanged file saves byte-for-byte: BOM, CRLF, semicolons, quoted fields", () => {
  const source = '﻿"Имя";Сумма;"Комментарий"\r\n"Анна";1 250,50;"сказала ""да""; ушла"\r\nБорис;;\r\n';
  const file = parseCsv(utf8(source), "csv");
  assert.equal(file.delimiter, ";");
  assert.deepEqual(file.rows[1], ["Анна", "1 250,50", 'сказала "да"; ушла']);
  assert.equal(read(serializeCsv(file)), source);
});

test("edits change only the edited fields and can grow the table", () => {
  const file = parseCsv(utf8("a,b\n1,2"), "csv");
  const out = read(serializeCsv(applyCsvEdits(file, [{ row: 1, col: 1, text: "x,y" }, { row: 2, col: 2, text: "new" }])));
  assert.equal(out, 'a,b\n1,"x,y"\n,,new');
});

test("Windows-1251 files are read and written back in Windows-1251", () => {
  const bytes = new Uint8Array([0xc8, 0xec, 0xff, 0x3b, 0x31, 0x0a]); // "Имя;1\n"
  const file = parseCsv(bytes, "csv");
  assert.equal(file.encoding, "windows-1251");
  assert.deepEqual(file.rows, [["Имя", "1"]]);
  assert.deepEqual([...serializeCsv(file)], [...bytes]);
  const edited = serializeCsv(applyCsvEdits(file, [{ row: 0, col: 1, text: "Да" }]));
  assert.deepEqual([...edited], [0xc8, 0xec, 0xff, 0x3b, 0xc4, 0xe0, 0x0a]);
  assert.throws(() => serializeCsv(applyCsvEdits(file, [{ row: 0, col: 1, text: "🚀" }])));
});

test("tsv uses tabs and multiline quoted fields survive", () => {
  const file = parseCsv(utf8('a,b\t"line 1\nline 2"\n'), "tsv");
  assert.deepEqual(file.rows, [["a,b", "line 1\nline 2"]]);
  assert.equal(read(serializeCsv(file)), 'a,b\t"line 1\nline 2"\n');
});
