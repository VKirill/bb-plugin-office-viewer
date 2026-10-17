import type { domToBlob } from "modern-screenshot";
import { SCREENSHOT_LIBRARY } from "../../html/capture";
import { stringList, type InlineTarget } from "./editing";
import { resizeBox, type DrawModifiers } from "./canvas-math";
import { SNAP, snap, type WireframeCanvas, type WireframeElement } from "./model";

export const MIN_SIZE = SNAP;
export const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
export type Handle = (typeof HANDLES)[number];

export const HANDLE_CLASS: Record<Handle, string> = {
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-n-resize",
  s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize",
  e: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-e-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-w-resize",
  ne: "right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-ne-resize",
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize",
  se: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize",
  sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize",
};

type Library = { domToBlob: typeof domToBlob };
let library: Promise<Library> | null = null;

export function loadScreenshotLibrary() {
  const scope = globalThis as { modernScreenshot?: Library };
  library ??= new Promise<Library>((resolve, reject) => {
    if (scope.modernScreenshot) return resolve(scope.modernScreenshot);
    const script = document.createElement("script");
    script.src = SCREENSHOT_LIBRARY;
    script.onload = () => (scope.modernScreenshot ? resolve(scope.modernScreenshot) : reject(new Error("modern-screenshot did not load")));
    script.onerror = () => reject(new Error("modern-screenshot did not load"));
    document.head.append(script);
  });
  library.catch(() => {
    library = null;
  });
  return library;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function resized(
  el: WireframeElement,
  handle: Handle,
  x: number,
  y: number,
  modifiers: DrawModifiers = { shift: false, alt: false },
): WireframeElement {
  const box = resizeBox(
    { x: el.x, y: el.y, w: el.w, h: el.h },
    handle,
    snap(x),
    snap(y),
    modifiers,
    { type: el.type, props: el.props as Record<string, string | number | boolean | string[] | undefined> },
  );
  return {
    ...el,
    x: snap(box.x),
    y: snap(box.y),
    w: Math.max(MIN_SIZE, snap(box.w)),
    h: Math.max(MIN_SIZE, snap(box.h)),
  };
}

export function placeOnCanvas(el: WireframeElement, canvas: WireframeCanvas): WireframeElement {
  const w = Math.min(el.w, canvas.width);
  const h = Math.min(el.h, canvas.height);
  return {
    ...el,
    w,
    h,
    x: snap(Math.max(0, Math.min(el.x, canvas.width - w))),
    y: snap(Math.max(0, Math.min(el.y, canvas.height - h))),
  };
}

export function editOverlayBox(el: WireframeElement, target: InlineTarget): { left: number; top: number; width: number; height: number } {
  if (target.kind === "item") {
    if (el.type === "List") {
      const n = Math.max(1, stringList(el, "items").length);
      const h = el.h / n;
      return { left: 16, top: target.index * h, width: Math.max(8, el.w - 20), height: h };
    }
    if (el.type === "Nav" || el.type === "Tabs" || el.type === "Menu" || el.type === "Breadcrumbs") {
      const n = Math.max(1, stringList(el, target.key).length);
      const orientation = el.props.orientation;
      const horizontal = el.type !== "Menu" || (typeof orientation === "string" ? orientation : "horizontal") !== "vertical";
      if (horizontal) {
        const w = el.w / n;
        return { left: target.index * w, top: 0, width: w, height: el.h };
      }
      const h = el.h / n;
      return { left: 0, top: target.index * h, width: el.w, height: h };
    }
    if (el.type === "ListBox" || el.type === "Tree") {
      const n = Math.max(1, stringList(el, "items").length);
      const h = el.h / n;
      return { left: 4, top: target.index * h, width: Math.max(8, el.w - 8), height: h };
    }
    if (el.type === "DynamicPanel" && target.key === "states") {
      const n = Math.max(1, stringList(el, "states").length);
      const h = (el.h - 24) / n;
      return { left: 8, top: 24 + target.index * h, width: Math.max(8, el.w - 16), height: h };
    }
    return { left: 8, top: 4, width: Math.max(8, el.w - 32), height: Math.max(8, el.h - 8) };
  }
  if (el.type === "Radio" || el.type === "Checkbox") {
    return { left: 24, top: 2, width: Math.max(8, el.w - 28), height: Math.max(8, el.h - 4) };
  }
  if (el.type === "Card" || el.type === "Modal") {
    return { left: 10, top: 8, width: Math.max(8, el.w - 20), height: 24 };
  }
  if (el.type === "Header") {
    return { left: 16, top: 8, width: Math.max(8, el.w - 32), height: Math.max(8, el.h - 16) };
  }
  return { left: 4, top: 4, width: Math.max(8, el.w - 8), height: Math.max(8, el.h - 8) };
}

export function noteNumbers(elements: readonly WireframeElement[]): Map<string, number> {
  const map = new Map<string, number>();
  let n = 0;
  for (const el of elements) {
    if (el.note?.trim()) map.set(el.id, ++n);
  }
  return map;
}

export function selectionBounds(elements: readonly WireframeElement[], selected: readonly string[]) {
  const picked = elements.filter((el) => selected.includes(el.id));
  if (!picked.length) return null;
  const left = Math.min(...picked.map((el) => el.x));
  const top = Math.min(...picked.map((el) => el.y));
  const right = Math.max(...picked.map((el) => el.x + el.w));
  const bottom = Math.max(...picked.map((el) => el.y + el.h));
  return { left, top, right, bottom, w: right - left, h: bottom - top };
}
