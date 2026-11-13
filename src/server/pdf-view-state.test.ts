import assert from "node:assert/strict";
import { test } from "node:test";
import { deletePdfViewStates, pdfViewStateKey, readPdfViewState, writePdfViewState } from "./pdf-view-state.ts";

const location = { hostId: "devbox", absPath: "/papers/diloco.pdf", rootPath: "/papers" };
const state = { page: 8, fraction: 0.35, horizontal: 0.7, zoom: 1.5 };

// Separate handles over the same backing rows model server plugin reloads. JSON
// round-trips match KV behavior and prevent object identity from hiding errors.
function store(rows = new Map<string, string>()) {
  return {
    async get(key: string): Promise<unknown> { const value = rows.get(key); return value === undefined ? undefined : JSON.parse(value); },
    async set(key: string, value: unknown) { rows.set(key, JSON.stringify(value)); },
    async list(prefix: string) { return [...rows.keys()].filter((key) => key.startsWith(prefix)); },
    async delete(key: string) { rows.delete(key); },
  };
}

test("a fresh plugin handle restores state from server storage", async () => {
  const rows = new Map<string, string>();
  assert.equal(await readPdfViewState(store(rows), "thread-a", location), null);
  await writePdfViewState(store(rows), "thread-a", location, state);
  assert.deepEqual(await readPdfViewState(store(rows), "thread-a", location), state);
});

test("deleting a thread removes only its PDF state", async () => {
  const kv = store();
  await writePdfViewState(kv, "thread-a", location, state);
  await writePdfViewState(kv, "thread-a", { ...location, absPath: "/second.pdf" }, state);
  await writePdfViewState(kv, "thread-a:other", location, state);
  await kv.set("unrelated", state);
  await deletePdfViewStates(kv, "thread-a");
  assert.equal(await readPdfViewState(kv, "thread-a", location), null);
  assert.equal(await readPdfViewState(kv, "thread-a", { ...location, absPath: "/second.pdf" }), null);
  assert.deepEqual(await readPdfViewState(kv, "thread-a:other", location), state);
  assert.deepEqual(await kv.get("unrelated"), state);
});

test("state is isolated across threads, machines and files", async () => {
  const kv = store();
  await writePdfViewState(kv, "thread-a", location, state);
  assert.deepEqual(await readPdfViewState(kv, "thread-a", { ...location, absPath: "/papers/sub/../diloco.pdf", rootPath: null }), state);
  assert.equal(await readPdfViewState(kv, "thread-b", location), null);
  await writePdfViewState(kv, "thread-b", location, { ...state, page: 2 });
  assert.equal((await readPdfViewState(kv, "thread-b", location))?.page, 2);
  assert.deepEqual(await readPdfViewState(kv, "thread-a", location), state);
  assert.equal(await readPdfViewState(kv, "thread-a", { ...location, hostId: "laptop" }), null);
  assert.equal(await readPdfViewState(kv, "thread-a", { ...location, absPath: "/papers/other.pdf" }), null);
});

test("invalid stored data falls back to the default view", async () => {
  const kv = store();
  await kv.set(pdfViewStateKey("thread-a", location), { ...state, fraction: -1 });
  assert.equal(await readPdfViewState(kv, "thread-a", location), null);
  await assert.rejects(writePdfViewState(kv, "thread-a", location, { ...state, zoom: Infinity }));
});
