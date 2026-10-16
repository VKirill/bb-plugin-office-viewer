import assert from "node:assert/strict";
import { test } from "node:test";
import { clampSide, DEVICES, fitGrid, MAIN_DEVICES, mockup, turned } from "./devices.ts";

test("a rotated device swaps its sides", () => {
  assert.deepEqual(turned({ w: 393, h: 852 }, true), { w: 852, h: 393 });
  assert.deepEqual(turned({ w: 1440, h: 900 }, false), { w: 1440, h: 900 });
});

test("device presets: unique ids, phones and tablets stored portrait, desktops landscape", () => {
  assert.equal(new Set(DEVICES.map((device) => device.id)).size, DEVICES.length);
  for (const device of DEVICES) assert.equal(device.kind === "desktop" ? device.width > device.height : device.width < device.height, true, device.id);
});

test("fit: never above 1, limited by the tighter side", () => {
  const none = { w: 0, h: 0 };
  assert.deepEqual(fitGrid([{ w: 400, h: 800 }], { w: 1000, h: 1000 }, 0, none), { scale: 1, columns: 1 });
  assert.equal(fitGrid([{ w: 1440, h: 900 }], { w: 720, h: 900 }, 0, none).scale, 0.5);
  assert.equal(fitGrid([{ w: 400, h: 800 }], { w: 1000, h: 400 }, 0, none).scale, 0.5);
});

test("fit: devices wrap into rows when that shows them larger; gaps and captions count", () => {
  const phone = { w: 400, h: 800 };
  // Wide area: side by side.
  assert.deepEqual(fitGrid([phone, phone], { w: 820, h: 800 }, 20, { w: 0, h: 0 }), { scale: 1, columns: 2 });
  // Tall narrow area: one above the other.
  assert.deepEqual(fitGrid([phone, phone], { w: 400, h: 1640 }, 20, { w: 0, h: 20 }), { scale: 0.9875, columns: 1 });
});

test("fit: narrow devices held at the caption width leave less room for the rest", () => {
  // At 0.5 the phone would be 50 px wide, below the 120 px minimum: the monitor gets 1000 - 20 - 120 = 860 px.
  assert.deepEqual(fitGrid([{ w: 100, h: 200 }, { w: 1720, h: 1000 }], { w: 1000, h: 600 }, 20, { w: 0, h: 0 }, 120), { scale: 0.5, columns: 2 });
  assert.equal(fitGrid([{ w: 100, h: 200 }, { w: 1720, h: 1000 }], { w: 1000, h: 600 }, 20, { w: 0, h: 0 }, 300).columns, 1);
});

test("custom sides are rounded and kept within limits", () => {
  assert.equal(clampSide(10), 240);
  assert.equal(clampSide(500.6), 501);
  assert.equal(clampSide(99999), 3840);
});

test("mockups: the page gets the screen minus system bars; the case adds up outside", () => {
  const monitor = mockup("monitor", { w: 1920, h: 1080 });
  assert.deepEqual(monitor.viewport, { w: 1920, h: 952 });
  assert.deepEqual(monitor.outer, { w: 1948, h: 1080 + 44 + monitor.foot });
  const phone = mockup("island", { w: 393, h: 852 });
  assert.deepEqual(phone.viewport, { w: 393, h: 764 });
  const sideways = mockup("island", { w: 852, h: 393 });
  assert.deepEqual(sideways.viewport, { w: 744, h: 372 });
  const bare = mockup("none", { w: 500, h: 700 });
  assert.deepEqual([bare.viewport, bare.outer], [{ w: 500, h: 700 }, { w: 500, h: 700 }]);
});

test("shares are percentages and every kind has presets", () => {
  for (const device of DEVICES) if (device.share !== undefined) assert.ok(device.share > 0 && device.share < 100, device.id);
  for (const kind of ["phone", "tablet", "desktop"]) assert.ok(DEVICES.some((device) => device.kind === kind), kind);
});

test("main screens: the narrowest and widest common phone, the common tablet, a small laptop and Full HD", () => {
  const sizes = MAIN_DEVICES.map((id) => DEVICES.find((device) => device.id === id)!).map((device) => `${device.width}×${device.height}`);
  assert.deepEqual(sizes, ["360×800", "414×896", "768×1024", "1366×768", "1920×1080"]);
});
