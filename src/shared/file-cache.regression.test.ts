import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { IDBDatabase as FakeDatabase, IDBFactory } from "fake-indexeddb";
import { fetchCached } from "./file-cache.ts";

const originalFetch = globalThis.fetch;
const key = "host-id\0/report.pdf";
const database = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("office-viewer-file-cache", 2);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("meta", { keyPath: "key" }).createIndex("usedAt", "usedAt");
    request.result.createObjectStore("blobs");
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function write(body: string, etag: string, usedAt = Date.now()) {
  const db = await database;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["meta", "blobs"], "readwrite");
    tx.objectStore("meta").put({ key, etag, size: body.length, usedAt });
    tx.objectStore("blobs").put(new Blob([body]), key);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

beforeEach(async () => {
  const db = await database;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(["meta", "blobs"], "readwrite");
    tx.objectStore("meta").clear();
    tx.objectStore("blobs").clear();
    tx.oncomplete = () => resolve();
  });
});
afterEach(() => { globalThis.fetch = originalFetch; });

test("a concurrent replacement cannot pair the validated ETag with another blob", async () => {
  await write("new", 'W/"new"');
  const tags: (string | null)[] = [];
  globalThis.fetch = async (_url, init) => {
    const tag = new Headers(init?.headers).get("if-none-match");
    tags.push(tag);
    if (tag) {
      // An older overlapping download finishes after this request captured its ETag.
      await write("old", 'W/"old"');
      return new Response(null, { status: 304 });
    }
    return new Response("new", { headers: { etag: 'W/"new"' } });
  };
  assert.equal(await (await fetchCached("/lease/report.pdf", key)).text(), "new");
  assert.deepEqual(tags, ['W/"new"', null]);
});

test("an entry idle for 31 days is a miss even if its server ETag still matches", async () => {
  await write("old", 'W/"same"', Date.now() - 31 * 86400000);
  let tag: string | null = null;
  globalThis.fetch = async (_url, init) => {
    tag = new Headers(init?.headers).get("if-none-match");
    return tag ? new Response(null, { status: 304 }) : new Response("fresh");
  };
  assert.equal(await (await fetchCached("/lease/report.pdf", key)).text(), "fresh");
  assert.equal(tag, null);
});

test("a hung Blob read falls back within the storage timeout", async () => {
  await write("cached", 'W/"same"');
  const tags: (string | null)[] = [];
  globalThis.fetch = async (_url, init) => {
    const tag = new Headers(init?.headers).get("if-none-match");
    tags.push(tag);
    return tag ? new Response(null, { status: 304 }) : new Response("downloaded");
  };
  const original = Blob.prototype.arrayBuffer;
  Blob.prototype.arrayBuffer = () => new Promise(() => {});
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetchCached("/lease/report.pdf", key),
      new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error("Blob read was not bounded")), 3500); }),
    ]);
    assert.equal(await response.text(), "downloaded");
    assert.deepEqual(tags, ['W/"same"', null]);
  } finally {
    clearTimeout(deadline);
    Blob.prototype.arrayBuffer = original;
  }
});

test("a network failure never exposes cached content as an offline fallback", async () => {
  await write("private document", 'W/"same"');
  globalThis.fetch = async () => { throw new TypeError("Offline"); };
  await assert.rejects(fetchCached("/lease/report.pdf", key), /Offline/);
});

test("storage transaction failures are cache misses, not unhandled rejections", async () => {
  globalThis.fetch = async () => new Response("downloaded", { headers: { etag: 'W/"new"' } });
  const transaction = FakeDatabase.prototype.transaction;
  FakeDatabase.prototype.transaction = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); };
  try {
    assert.equal(await (await fetchCached("/lease/report.pdf", key)).text(), "downloaded");
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    FakeDatabase.prototype.transaction = transaction;
  }
});

test("an aborted transaction falls back without leaving a rejected completion promise", async () => {
  globalThis.fetch = async () => new Response("downloaded", { headers: { etag: 'W/"new"' } });
  const transaction = FakeDatabase.prototype.transaction;
  FakeDatabase.prototype.transaction = function (...args) {
    const tx = transaction.apply(this, args);
    queueMicrotask(() => tx.abort());
    return tx;
  };
  try {
    assert.equal(await (await fetchCached("/lease/report.pdf", key)).text(), "downloaded");
    await new Promise((resolve) => setTimeout(resolve, 25));
  } finally {
    FakeDatabase.prototype.transaction = transaction;
  }
});

test("a response without an ETag is returned without buffering a blob", async () => {
  const response = new Response("plain");
  response.blob = () => { throw new Error("Unexpected buffering"); };
  globalThis.fetch = async () => response;
  assert.equal(await fetchCached("/lease/report.pdf", key), response);
});

test("an oversized advertised response bypasses the cache before buffering", async () => {
  const response = new Response("large", { headers: { etag: 'W/"large"', "content-length": String(101 * 1024 * 1024) } });
  response.blob = () => { throw new Error("Unexpected buffering"); };
  globalThis.fetch = async () => response;
  assert.equal(await fetchCached("/lease/report.pdf", key), response);
});

test("eviction keeps at most 500 MiB and removes expired records on a write", async () => {
  const db = await database;
  const tx = db.transaction(["meta", "blobs"], "readwrite");
  const complete = new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
  for (let i = 0; i < 6; i++) {
    const oldKey = `host\0/large-${i}.pdf`;
    tx.objectStore("meta").put({ key: oldKey, etag: String(i), size: 100 * 1024 * 1024, usedAt: Date.now() - 1000 - i });
    tx.objectStore("blobs").put(new Blob(["fixture"]), oldKey);
  }
  tx.objectStore("meta").put({ key: "expired", etag: "expired", size: 1, usedAt: Date.now() - 31 * 86400000 });
  tx.objectStore("blobs").put(new Blob(["x"]), "expired");
  await complete;
  globalThis.fetch = async () => new Response("downloaded", { headers: { etag: 'W/"new"' } });
  await fetchCached("/lease/report.pdf", key);
  // The write is queued before this transaction, so completion is a deterministic barrier.
  await new Promise<void>((resolve) => {
    const barrier = db.transaction(["meta", "blobs"]);
    const request = barrier.objectStore("meta").getAll();
    request.onsuccess = () => {
      const records = request.result as { key: string; size: number }[];
      assert.ok(records.reduce((sum, row) => sum + row.size, 0) <= 500 * 1024 * 1024);
      assert.ok(!records.some((row) => row.key === "expired" || row.key === "host\0/large-5.pdf"));
    };
    barrier.oncomplete = () => resolve();
  });
});

test("unavailable IndexedDB falls back to a direct download", async () => {
  const actual = globalThis.indexedDB;
  Reflect.deleteProperty(globalThis, "indexedDB");
  globalThis.fetch = async () => new Response("downloaded", { headers: { etag: 'W/"new"' } });
  try {
    const fresh = await import(new URL("./file-cache.ts?unavailable", import.meta.url).href);
    assert.equal(await (await fresh.fetchCached("/lease/report.pdf", key)).text(), "downloaded");
  } finally {
    globalThis.indexedDB = actual;
  }
});

test("invalid persisted metadata is discarded before it can become an HTTP header", async () => {
  await write("cached", "invalid\r\netag");
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("if-none-match"), null);
    return new Response("downloaded");
  };
  assert.equal(await (await fetchCached("/lease/report.pdf", key)).text(), "downloaded");
});

test("a blocked upgrade falls back and closes its abandoned connection when unblocked", async () => {
  const actual = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  const old = await new Promise<IDBDatabase>((resolve) => {
    const request = indexedDB.open("office-viewer-file-cache", 1);
    request.onsuccess = () => resolve(request.result);
  });
  globalThis.fetch = async () => new Response("downloaded");
  try {
    const fresh = await import(new URL("./file-cache.ts?blocked", import.meta.url).href);
    assert.equal(await (await fresh.fetchCached("/lease/report.pdf", key)).text(), "downloaded");
    old.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("office-viewer-file-cache", 3);
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onblocked = () => reject(new Error("Abandoned cache connection blocks the next upgrade"));
    });
  } finally {
    old.close();
    globalThis.indexedDB = actual;
  }
});
