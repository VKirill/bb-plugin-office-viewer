// Uniform grid spatial index for snap peer queries on large pages.
import type { CanvasRect } from "./canvas-math.ts";
import { elementRect } from "./canvas-math.ts";
import type { WireframeElement } from "./model.ts";

export const SNAP_SPATIAL_CELL = 128;
export const SNAP_SPATIAL_MIN_PEERS = 64;

function cellKey(cx: number, cy: number): string {
  return `${cx}:${cy}`;
}

export class ElementSpatialIndex {
  private readonly cellSize: number;
  private readonly cells = new Map<string, WireframeElement[]>();

  constructor(elements: readonly WireframeElement[], cellSize = SNAP_SPATIAL_CELL) {
    this.cellSize = cellSize;
    for (const el of elements) {
      if (el.hidden) continue;
      const box = elementRect(el);
      const x0 = Math.floor(box.left / cellSize);
      const x1 = Math.floor(box.right / cellSize);
      const y0 = Math.floor(box.top / cellSize);
      const y1 = Math.floor(box.bottom / cellSize);
      for (let cx = x0; cx <= x1; cx += 1) {
        for (let cy = y0; cy <= y1; cy += 1) {
          const key = cellKey(cx, cy);
          const bucket = this.cells.get(key);
          if (bucket) bucket.push(el);
          else this.cells.set(key, [el]);
        }
      }
    }
  }

  query(rect: CanvasRect, padding = 0): WireframeElement[] {
    const left = rect.left - padding;
    const top = rect.top - padding;
    const right = rect.right + padding;
    const bottom = rect.bottom + padding;
    const x0 = Math.floor(left / this.cellSize);
    const x1 = Math.floor(right / this.cellSize);
    const y0 = Math.floor(top / this.cellSize);
    const y1 = Math.floor(bottom / this.cellSize);
    const seen = new Set<string>();
    const out: WireframeElement[] = [];
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const bucket = this.cells.get(cellKey(cx, cy));
        if (!bucket) continue;
        for (const el of bucket) {
          if (seen.has(el.id)) continue;
          seen.add(el.id);
          out.push(el);
        }
      }
    }
    return out;
  }
}
