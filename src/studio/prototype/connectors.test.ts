import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultElement } from "./model.ts";
import {
  anchorPoint,
  boundsFromPoints,
  connectorPathPoints,
  createConnectorElement,
  detachConnectorsOnDelete,
  distanceToPolyline,
  pickAnchor,
  readConnectorProps,
  refreshConnectorsForElements,
  routePoints,
  refreshConnector,
} from "./connectors.ts";

test("anchor points sit on element edges", () => {
  const box = defaultElement("Box", 100, 80);
  box.w = 120;
  box.h = 64;
  assert.deepEqual(anchorPoint(box, "top"), { x: box.x + box.w / 2, y: box.y });
  assert.deepEqual(anchorPoint(box, "left"), { x: box.x, y: box.y + box.h / 2 });
});

test("elbow routing uses orthogonal segments", () => {
  const points = routePoints({ x: 0, y: 0 }, { x: 100, y: 40 }, "elbow", "right", "left", null);
  assert.ok(points.length >= 3);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    assert.ok(a.x === b.x || a.y === b.y);
  }
});

test("connector bounds wrap the path", () => {
  const a = defaultElement("Shape", 0, 0);
  const b = defaultElement("Shape", 200, 100);
  const connector = createConnectorElement("c1", "Connector 1", [a, b], { elementId: a.id, x: 0, y: 0 }, { elementId: b.id, x: 0, y: 0 });
  connector.id = "c1";
  const points = connectorPathPoints(connector, [a, b, connector]);
  const bounds = boundsFromPoints(points);
  for (const p of points) {
    assert.ok(p.x >= bounds.x && p.x <= bounds.x + bounds.w);
    assert.ok(p.y >= bounds.y && p.y <= bounds.y + bounds.h);
  }
});

test("refresh moves connector bounds when attached shape moves", () => {
  const a = defaultElement("Box", 0, 0);
  const b = defaultElement("Box", 160, 0);
  let connector = createConnectorElement("c1", "Connector 1", [a, b], { elementId: a.id, x: 0, y: 0 }, { elementId: b.id, x: 0, y: 0 });
  const movedA = { ...a, x: 40, y: 24 };
  const next = refreshConnectorsForElements([movedA, b, connector], new Set([a.id]));
  const updated = next.find((el) => el.id === "c1")!;
  const beforeStart = connectorPathPoints(connector, [a, b, connector])[0]!;
  const afterStart = connectorPathPoints(updated, [movedA, b, updated])[0]!;
  assert.notEqual(beforeStart.x, afterStart.x);
});

test("deleting an attached element leaves a free end at last point", () => {
  const a = defaultElement("Box", 0, 0);
  const b = defaultElement("Box", 200, 0);
  const connector = createConnectorElement("c1", "Connector 1", [a, b], { elementId: a.id, x: 0, y: 0 }, { elementId: b.id, x: 0, y: 0 });
  connector.id = "c1";
  const endBefore = connectorPathPoints(connector, [a, b, connector]).at(-1)!;
  const next = detachConnectorsOnDelete([a, b, connector], new Set([b.id]));
  const updated = next.find((el) => el.id === "c1")!;
  const props = readConnectorProps(updated);
  assert.equal(props.toId, "");
  assert.equal(props.endX, endBefore.x);
  assert.equal(props.endY, endBefore.y);
});

test("pickAnchor chooses facing side", () => {
  const left = defaultElement("Box", 0, 0);
  const right = defaultElement("Box", 200, 0);
  assert.equal(pickAnchor(left, right, "from"), "right");
  assert.equal(pickAnchor(right, left, "to"), "right");
});

test("distance to polyline is zero on the segment", () => {
  const d = distanceToPolyline(50, 10, [{ x: 0, y: 10 }, { x: 100, y: 10 }]);
  assert.ok(d < 0.01);
});

test("refreshConnector updates free coordinates", () => {
  const connector = defaultElement("Connector", 0, 0);
  connector.props = {
    ...connector.props,
    fromId: "",
    toId: "",
    startX: 8,
    startY: 8,
    endX: 80,
    endY: 40,
    routing: "straight",
  };
  const refreshed = refreshConnector(connector, [connector]);
  assert.ok(refreshed.w >= 8);
  assert.ok(refreshed.h >= 8);
});
