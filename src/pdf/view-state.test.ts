import assert from "node:assert/strict";
import { test } from "node:test";
import { createViewStateSaver, pdfViewStateSchema, type PdfViewState } from "./view-state.ts";

const state: PdfViewState = { page: 5, fraction: 0.4, horizontal: 0.5, zoom: "width" };

test("reading state rejects invalid coordinates and zoom", () => {
  for (const change of [{ page: -1 }, { page: 1.2 }, { fraction: NaN }, { fraction: 1.1 }, { horizontal: -1 }, { zoom: 0 }, { zoom: Infinity }, { zoom: "other" }]) {
    assert.equal(pdfViewStateSchema.safeParse({ ...state, ...change }).success, false);
  }
  assert.deepEqual(pdfViewStateSchema.parse(state), state);
  assert.equal(pdfViewStateSchema.parse({ ...state, zoom: 1.25 }).zoom, 1.25);
});

test("scrolling is debounced and closing flushes only the latest position", async () => {
  const writes: PdfViewState[] = [];
  const saver = createViewStateSaver(async (value) => { writes.push(value); }, (error) => assert.fail(String(error)));
  saver.update(state);
  saver.update({ ...state, page: 8 });
  assert.equal(writes.length, 0);
  await saver.flush();
  assert.deepEqual(writes, [{ ...state, page: 8 }]);
  await saver.flush();
  assert.equal(writes.length, 1);
});

test("idle scrolling saves without needing panel cleanup", async () => {
  const writes: PdfViewState[] = [];
  const saver = createViewStateSaver(async (value) => { writes.push(value); }, (error) => assert.fail(String(error)), 5);
  saver.update(state);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(writes, [state]);
});

test("an in-flight save cannot overtake the final position on close", async () => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const writes: number[] = [];
  const saver = createViewStateSaver(async (value) => {
    if (value.page === 5) await blocked;
    writes.push(value.page);
  }, (error) => assert.fail(String(error)));
  saver.update(state);
  const first = saver.flush();
  await Promise.resolve();
  saver.update({ ...state, page: 9 });
  const closing = saver.flush();
  assert.deepEqual(writes, []);
  release();
  await Promise.all([first, closing]);
  assert.deepEqual(writes, [5, 9]);
});

test("a failed save does not prevent subsequent saves", async () => {
  const errors: unknown[] = [];
  const writes: number[] = [];
  const saver = createViewStateSaver(async (value) => {
    if (value.page === 5) throw new Error("offline");
    writes.push(value.page);
  }, (error) => errors.push(error));
  saver.update(state);
  await saver.flush();
  saver.update({ ...state, page: 10 });
  await saver.flush();
  assert.equal(errors.length, 1);
  assert.deepEqual(writes, [10]);
});
