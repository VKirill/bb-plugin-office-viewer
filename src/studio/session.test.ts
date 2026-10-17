import assert from "node:assert/strict";
import { test } from "node:test";
import { newPaintDoc } from "./paint/paint-model.ts";
import { getActivePage, newWireframe } from "./prototype/model.ts";
import { newDeck } from "./slides/model.ts";
import {
  autosaveLabelKey,
  parseThreadSession,
  patchThreadSession,
  readThreadSession,
  writeThreadSession,
} from "./session.ts";

const THREAD_A = "thr_session_a";
const THREAD_B = "thr_session_b";

test("parseThreadSession accepts a full v1 snapshot", () => {
  const doc = newWireframe("Board");
  const deck = newDeck("Talk");
  const paint = newPaintDoc("Sketch");
  const parsed = parseThreadSession({
    v: 1,
    tool: "prototype",
    prototype: { doc, openedStem: "Board", zoom: 1.25, selected: ["el1"], openTabIds: [getActivePage(doc).id] },
    slides: { deck, openedStem: "Talk", zoom: 0.65, selected: [] },
    paint: { doc: paint, openedStem: "Sketch", editorOpen: true },
  });
  assert.equal(parsed?.tool, "prototype");
  assert.equal(parsed?.prototype?.openedStem, "Board");
  assert.equal(parsed?.prototype?.zoom, 1.25);
  assert.deepEqual(parsed?.prototype?.selected, ["el1"]);
  assert.equal(parsed?.slides?.deck.name, "Talk");
  assert.equal(parsed?.paint?.editorOpen, true);
});

test("parseThreadSession rejects unknown versions and keeps valid tools only", () => {
  assert.equal(parseThreadSession({ v: 2, tool: "prototype" }), null);
  assert.equal(parseThreadSession(null), null);
  assert.equal(parseThreadSession({ v: 1, tool: "other" })?.tool, null);
  const broken = parseThreadSession({ v: 1, tool: "slides", prototype: { doc: { format: "nope" } } });
  assert.equal(broken?.tool, "slides");
  assert.equal(broken?.prototype, undefined);
});

test("parseThreadSession clamps zoom and drops non-string ids", () => {
  const doc = newWireframe("Z");
  const parsed = parseThreadSession({
    v: 1,
    tool: "prototype",
    prototype: { doc, openedStem: null, zoom: 99, selected: ["ok", 1, ""], openTabIds: getActivePage(doc).id },
  });
  assert.equal(parsed?.prototype?.zoom, 8);
  assert.deepEqual(parsed?.prototype?.selected, ["ok"]);
  assert.deepEqual(parsed?.prototype?.openTabIds, []);
});

test("sessions are isolated per thread", () => {
  const doc = newWireframe("A");
  writeThreadSession(THREAD_A, { v: 1, tool: "prototype", prototype: { doc, openedStem: "A", zoom: 2, selected: [], openTabIds: [getActivePage(doc).id] } });
  writeThreadSession(THREAD_B, { v: 1, tool: "paint" });
  assert.equal(readThreadSession(THREAD_A).tool, "prototype");
  assert.equal(readThreadSession(THREAD_B).tool, "paint");
  assert.equal(readThreadSession(THREAD_A).prototype?.openedStem, "A");
  assert.equal(readThreadSession(THREAD_B).prototype, undefined);
});

test("patchThreadSession keeps other fields", () => {
  writeThreadSession(THREAD_A, { v: 1, tool: "slides", slides: { deck: newDeck("Keep"), openedStem: "Keep", zoom: 1, selected: ["x"] } });
  patchThreadSession(THREAD_A, { tool: "prototype" });
  const next = readThreadSession(THREAD_A);
  assert.equal(next.tool, "prototype");
  assert.equal(next.slides?.openedStem, "Keep");
  assert.deepEqual(next.slides?.selected, ["x"]);
});

test("autosaveLabelKey maps each status", () => {
  assert.equal(autosaveLabelKey("idle"), null);
  assert.equal(autosaveLabelKey("saving"), "saving");
  assert.equal(autosaveLabelKey("saved"), "saved");
  assert.equal(autosaveLabelKey("dirty"), "unsavedChanges");
  assert.equal(autosaveLabelKey("error"), "studioAutosaveFailed");
});
