// Large-document fixture and snap benchmarks for performance regression checks.
import { defaultElement, newWireframe, type WireframePage } from "./model.ts";
import { elementRect, snapRectToPeers, type CanvasRect } from "./canvas-math.ts";
import { ElementSpatialIndex, SNAP_SPATIAL_CELL, SNAP_SPATIAL_MIN_PEERS } from "./spatial-index.ts";

export const PERF_FIXTURE_ELEMENT_COUNT = 500;

export function buildPerfPage(elementCount = PERF_FIXTURE_ELEMENT_COUNT): WireframePage {
  const doc = newWireframe("Perf");
  const page = doc.pages[0]!;
  const cols = Math.ceil(Math.sqrt(elementCount));
  const elements = [];
  for (let i = 0; i < elementCount; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const el = defaultElement("Box", col * 48, row * 40);
    el.id = `perf_${i}`;
    el.w = 40;
    el.h = 32;
    elements.push(el);
  }
  return { ...page, elements };
}

function snapPeersNaive(rect: CanvasRect, peers: readonly ReturnType<typeof defaultElement>[], exclude: Set<string>, threshold: number) {
  snapRectToPeers(rect, peers, exclude, threshold);
}

function snapPeersIndexed(rect: CanvasRect, peers: readonly ReturnType<typeof defaultElement>[], exclude: Set<string>, threshold: number) {
  const index = new ElementSpatialIndex(peers);
  snapRectToPeers(rect, peers, exclude, threshold, index);
}

export type SnapBenchResult = {
  elementCount: number;
  naiveMs: number;
  indexedMs: number;
  speedup: number;
};

export function benchSnapOnPerfPage(elementCount = PERF_FIXTURE_ELEMENT_COUNT, iterations = 12): SnapBenchResult {
  const page = buildPerfPage(elementCount);
  const peers = page.elements;
  const moving = peers[Math.floor(peers.length / 2)]!;
  const rect = elementRect(moving);
  const exclude = new Set([moving.id]);
  const threshold = 8;

  const runNaive = () => {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      snapPeersNaive(rect, peers, exclude, threshold);
    }
    return performance.now() - start;
  };

  const runIndexed = () => {
    const start = performance.now();
    for (let i = 0; i < iterations; i += 1) {
      snapPeersIndexed(rect, peers, exclude, threshold);
    }
    return performance.now() - start;
  };

  const naiveMs = runNaive();
  const indexedMs = runIndexed();
  return {
    elementCount,
    naiveMs,
    indexedMs,
    speedup: naiveMs / Math.max(indexedMs, 0.001),
  };
}

export function perfFixtureUsesSpatialIndex(peerCount: number): boolean {
  return peerCount >= SNAP_SPATIAL_MIN_PEERS;
}
