import assert from "node:assert/strict";
import { test } from "node:test";
import {
  eraseShapesAt,
  newPaintDoc,
  parsePaintDoc,
  shapeHitsPoint,
  type PaintShape,
} from "./paint-model.ts";

const ink = { id: "s1", color: "#ef4444", size: 4 };

function rect(over: { id?: string; x?: number; y?: number } = {}): PaintShape {
  return { ...ink, type: "rect", fill: false, x: 10, y: 20, w: 40, h: 30, ...over };
}

test("parsePaintDoc round-trips a valid document", () => {
  const doc = newPaintDoc("Sketch");
  doc.shapes.push(rect(), { ...ink, id: "s2", type: "pen", points: [0, 0, 8, 12, 20, 18] });
  const again = parsePaintDoc(JSON.stringify(doc));
  assert.deepEqual(again, doc);
  assert.equal(again.format, "bb-paint");
  assert.equal(again.version, 1);
});

test("newPaintDoc uses the wide white canvas", () => {
  const doc = newPaintDoc();
  assert.deepEqual(doc.canvas, { width: 1280, height: 800, background: "#ffffff" });
  assert.deepEqual(doc.shapes, []);
});

test("parsePaintDoc rejects a bad file", () => {
  assert.throws(() => parsePaintDoc("{"), SyntaxError);
  assert.throws(() => parsePaintDoc({ format: "other", version: 1, name: "A", canvas: { width: 100, height: 100, background: "#fff" }, shapes: [] }));
  assert.throws(() => parsePaintDoc({ ...newPaintDoc(), version: 2 }));
  assert.throws(() => parsePaintDoc({ ...newPaintDoc(), shapes: [{ ...ink, type: "pen", points: [0] }] }));
  assert.throws(() => parsePaintDoc({ ...newPaintDoc(), canvas: { width: 0, height: 100, background: "#fff" } }));
});

test("eraser hits a rectangle it touches and misses one it does not", () => {
  const box = rect();
  assert.equal(shapeHitsPoint(box, 30, 35, 2), true);
  assert.equal(shapeHitsPoint(box, 10, 20, 0), true);
  assert.equal(shapeHitsPoint(box, 100, 100, 2), false);
  assert.equal(shapeHitsPoint(box, 55, 35, 6), true);
});

test("eraser hits a line near the stroke and misses far away", () => {
  const line: PaintShape = { ...ink, type: "line", x1: 0, y1: 0, x2: 40, y2: 0 };
  assert.equal(shapeHitsPoint(line, 20, 0, 1), true);
  assert.equal(shapeHitsPoint(line, 20, 3, 1), true);
  assert.equal(shapeHitsPoint(line, 20, 20, 1), false);
});

test("eraser hits a pen polyline and an ellipse", () => {
  const stroke: PaintShape = { ...ink, type: "pen", points: [0, 0, 10, 0, 10, 10] };
  const oval: PaintShape = { ...ink, id: "e", type: "ellipse", fill: false, x: 50, y: 50, w: 20, h: 10 };
  assert.equal(shapeHitsPoint(stroke, 10, 5, 1), true);
  assert.equal(shapeHitsPoint(stroke, 40, 40, 1), false);
  assert.equal(shapeHitsPoint(oval, 60, 55, 1), true);
  assert.equal(shapeHitsPoint(oval, 90, 55, 1), false);
});

test("eraser hits a numbered step inside its radius", () => {
  const step: PaintShape = { ...ink, type: "step", x: 80, y: 80, n: 1 };
  assert.equal(shapeHitsPoint(step, 80, 80, 0), true);
  assert.equal(shapeHitsPoint(step, 200, 200, 0), false);
});

test("eraseShapesAt drops only the shapes the eraser touches", () => {
  const keep = rect({ id: "keep", x: 200, y: 200 });
  const gone = rect({ id: "gone" });
  const next = eraseShapesAt([keep, gone], 30, 35, 2);
  assert.deepEqual(next, [keep]);
});
