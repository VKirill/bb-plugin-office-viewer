import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchCached } from "./file-cache.ts";

type Call = { url: string; ifNoneMatch: string | null };

/** A preview route: answers 304 to a matching If-None-Match, else the file with its ETag. */
function serve(file: { body: string; etag: string } | null) {
  const calls: Call[] = [];
  globalThis.fetch = async (input, init) => {
    const ifNoneMatch = new Headers(init?.headers).get("if-none-match");
    calls.push({ url: String(input), ifNoneMatch });
    if (!file) return new Response(null, { status: 404 });
    if (ifNoneMatch === file.etag) return new Response(null, { status: 304, headers: { etag: file.etag } });
    return new Response(file.body, { status: 200, headers: { etag: file.etag } });
  };
  return calls;
}

/** Lets the background write after a download finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

test("an unchanged file is served from the stored copy after a 304", async () => {
  const calls = serve({ body: "version one", etag: 'W/"a"' });
  assert.equal(await (await fetchCached("/p/1/a.pdf", "host\0/a.pdf")).text(), "version one");
  await settle();
  const again = await fetchCached("/p/2/a.pdf", "host\0/a.pdf");
  assert.equal(await again.text(), "version one");
  assert.deepEqual(calls.map((call) => call.ifNoneMatch), [null, 'W/"a"']);
});

test("a changed file is downloaded again and replaces the stored copy", async () => {
  serve({ body: "old", etag: 'W/"old"' });
  await (await fetchCached("/p/1/b.pdf", "host\0/b.pdf")).text();
  await settle();
  const calls = serve({ body: "new", etag: 'W/"new"' });
  assert.equal(await (await fetchCached("/p/2/b.pdf", "host\0/b.pdf")).text(), "new");
  await settle();
  assert.equal(await (await fetchCached("/p/3/b.pdf", "host\0/b.pdf")).text(), "new");
  assert.deepEqual(calls.map((call) => call.ifNoneMatch), ['W/"old"', 'W/"new"']);
});

test("errors pass through unchanged", async () => {
  serve(null);
  const response = await fetchCached("/p/1/missing.pdf", "host\0/missing.pdf");
  assert.equal(response.status, 404);
});

test("a stored copy that cannot be read is dropped and the file downloaded again", async () => {
  serve({ body: "content", etag: 'W/"c"' });
  await (await fetchCached("/p/1/c.pdf", "host\0/c.pdf")).text();
  await settle();
  const arrayBuffer = Blob.prototype.arrayBuffer;
  Blob.prototype.arrayBuffer = () => Promise.reject(new Error("NotReadableError"));
  try {
    const calls = serve({ body: "content", etag: 'W/"c"' });
    assert.equal(await (await fetchCached("/p/2/c.pdf", "host\0/c.pdf")).text(), "content");
    assert.deepEqual(calls.map((call) => call.ifNoneMatch), ['W/"c"', null]);
  } finally {
    Blob.prototype.arrayBuffer = arrayBuffer;
  }
});
