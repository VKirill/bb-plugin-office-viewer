// Auto-layout stacks, resize constraints, and per-device page views.
import { absolutePosition, childrenOf, readParent } from "./containers.ts";
import {
  CANVAS_PRESETS,
  SNAP,
  defaultElement,
  newElementId,
  snap,
  type PropValue,
  type ElementConstraints,
  type ElementViewOverride,
  type PageViewData,
  type WireframeElement,
  type WireframePage,
} from "./model.ts";

export type StackDirection = "vertical" | "horizontal" | "wrap";
export type StackAlign = "start" | "center" | "end" | "stretch";
export type StackJustify = "start" | "center" | "end" | "space-between";
export type StackSizing = "fixed" | "hug" | "fill";
export type ChildSizing = "fixed" | "hug" | "fill";
export type PageDeviceView = "desktop" | "tablet" | "phone";
export type ConstraintHorizontal = "left" | "right" | "leftRight" | "center" | "scale";
export type ConstraintVertical = "top" | "bottom" | "topBottom" | "center" | "scale";

export type { ElementConstraints, ElementViewOverride, PageViewData };

export type StackLayout = {
  direction: StackDirection;
  gap: number;
  padding: [number, number, number, number];
  align: StackAlign;
  justify: StackJustify;
  sizing: StackSizing;
};

const STACK_TYPES = new Set(["Container", "Box", "Card"]);

export function defaultStackLayout(): StackLayout {
  return {
    direction: "vertical",
    gap: SNAP,
    padding: [SNAP, SNAP, SNAP, SNAP],
    align: "stretch",
    justify: "start",
    sizing: "hug",
  };
}

export function isAutoLayoutStack(el: WireframeElement): boolean {
  return STACK_TYPES.has(el.type) && el.props.autoLayout === true;
}

function numProp(props: Record<string, PropValue>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function strProp<T extends string>(props: Record<string, PropValue>, key: string, allowed: readonly T[], fallback: T): T {
  const value = props[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function readStackLayout(el: WireframeElement): StackLayout {
  const p = el.props;
  const pad = numProp(p, "layoutPadding", SNAP);
  const padLinked = p.layoutPaddingLinked === true;
  const padding: [number, number, number, number] = padLinked
    ? [pad, pad, pad, pad]
    : [
        numProp(p, "layoutPaddingTop", pad),
        numProp(p, "layoutPaddingRight", pad),
        numProp(p, "layoutPaddingBottom", pad),
        numProp(p, "layoutPaddingLeft", pad),
      ];
  return {
    direction: strProp(p, "layoutDirection", ["vertical", "horizontal", "wrap"] as const, "vertical"),
    gap: snap(numProp(p, "layoutGap", SNAP)),
    padding: padding.map((v) => snap(v)) as [number, number, number, number],
    align: strProp(p, "layoutAlign", ["start", "center", "end", "stretch"] as const, "stretch"),
    justify: strProp(p, "layoutJustify", ["start", "center", "end", "space-between"] as const, "start"),
    sizing: strProp(p, "layoutSizing", ["fixed", "hug", "fill"] as const, "hug"),
  };
}

export function writeStackLayout(el: WireframeElement, layout: Partial<StackLayout>): WireframeElement {
  const current = readStackLayout(el);
  const next = { ...current, ...layout };
  const [top, right, bottom, left] = next.padding;
  return {
    ...el,
    props: {
      ...el.props,
      autoLayout: true,
      layoutDirection: next.direction,
      layoutGap: next.gap,
      layoutPadding: top,
      layoutPaddingTop: top,
      layoutPaddingRight: right,
      layoutPaddingBottom: bottom,
      layoutPaddingLeft: left,
      layoutAlign: next.align,
      layoutJustify: next.justify,
      layoutSizing: next.sizing,
    },
  };
}

export function readChildSizing(el: WireframeElement): ChildSizing {
  const value = el.props.layoutSizing;
  if (value === "hug" || value === "fill" || value === "fixed") return value;
  return "fixed";
}

export function writeChildSizing(el: WireframeElement, sizing: ChildSizing): WireframeElement {
  return { ...el, props: { ...el.props, layoutSizing: sizing } };
}

export function readConstraints(el: WireframeElement): ElementConstraints | null {
  const raw = el.constraints;
  if (!raw) return null;
  return raw;
}

export function writeConstraints(el: WireframeElement, constraints: ElementConstraints | null): WireframeElement {
  return constraints ? { ...el, constraints } : { ...el, constraints: undefined };
}

function childMeasure(el: WireframeElement, sizing: ChildSizing): { w: number; h: number } {
  if (sizing === "hug") return { w: Math.max(SNAP, el.w), h: Math.max(SNAP, el.h) };
  return { w: el.w, h: el.h };
}

function layoutVertical(
  stack: WireframeElement,
  layout: StackLayout,
  children: WireframeElement[],
): { stack: WireframeElement; children: WireframeElement[] } {
  const [padTop, padRight, padBottom, padLeft] = layout.padding;
  const innerW = Math.max(SNAP, stack.w - padLeft - padRight);
  let cursorY = padTop;
  const placed: WireframeElement[] = [];
  let maxW = 0;
  for (const child of children) {
    const sizing = readChildSizing(child);
    let { w, h } = childMeasure(child, sizing);
    const intrinsicW = w;
    if (layout.align === "stretch" || sizing === "fill") w = innerW;
    w = Math.min(w, innerW);
    let x = padLeft;
    if (layout.align === "center") x = padLeft + (innerW - w) / 2;
    if (layout.align === "end") x = padLeft + innerW - w;
    x = snap(x);
    const y = snap(cursorY);
    placed.push({ ...child, x, y, w: snap(w), h: snap(h) });
    maxW = Math.max(maxW, layout.sizing === "hug" ? intrinsicW : w);
    cursorY += h + layout.gap;
  }
  if (children.length) cursorY -= layout.gap;
  cursorY += padBottom;
  let stackW = stack.w;
  let stackH = stack.h;
  if (layout.sizing === "hug") {
    stackW = snap(maxW + padLeft + padRight);
    stackH = snap(cursorY);
  }
  return { stack: { ...stack, w: stackW, h: stackH }, children: placed };
}

function layoutHorizontal(
  stack: WireframeElement,
  layout: StackLayout,
  children: WireframeElement[],
): { stack: WireframeElement; children: WireframeElement[] } {
  const [padTop, padRight, padBottom, padLeft] = layout.padding;
  const innerH = Math.max(SNAP, stack.h - padTop - padBottom);
  const sizes = children.map((child) => {
    const sizing = readChildSizing(child);
    return childMeasure(child, sizing);
  });
  const totalMain = sizes.reduce((sum, item) => sum + item.w, 0) + layout.gap * Math.max(0, children.length - 1);
  const innerW = Math.max(SNAP, stack.w - padLeft - padRight);
  let cursorX = padLeft;
  if (layout.justify === "center") cursorX = padLeft + (innerW - totalMain) / 2;
  if (layout.justify === "end") cursorX = padLeft + innerW - totalMain;
  let extraGap = 0;
  if (layout.justify === "space-between" && children.length > 1) {
    extraGap = (innerW - sizes.reduce((s, i) => s + i.w, 0)) / (children.length - 1);
    cursorX = padLeft;
  }
  const placed: WireframeElement[] = [];
  let maxH = 0;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]!;
    const sizing = readChildSizing(child);
    let { w, h } = sizes[i]!;
    if (layout.align === "stretch" || sizing === "fill") h = innerH;
    h = Math.min(h, innerH);
    let y = padTop;
    if (layout.align === "center") y = padTop + (innerH - h) / 2;
    if (layout.align === "end") y = padTop + innerH - h;
    placed.push({ ...child, x: snap(cursorX), y: snap(y), w: snap(w), h: snap(h) });
    maxH = Math.max(maxH, h);
    cursorX += w + (layout.justify === "space-between" ? extraGap : layout.gap);
  }
  let stackW = stack.w;
  let stackH = stack.h;
  if (layout.sizing === "hug") {
    stackW = snap(totalMain + padLeft + padRight);
    stackH = snap(maxH + padTop + padBottom);
  }
  return { stack: { ...stack, w: stackW, h: stackH }, children: placed };
}

function layoutWrap(
  stack: WireframeElement,
  layout: StackLayout,
  children: WireframeElement[],
): { stack: WireframeElement; children: WireframeElement[] } {
  const [padTop, padRight, padBottom, padLeft] = layout.padding;
  const innerW = Math.max(SNAP, stack.w - padLeft - padRight);
  let cursorX = padLeft;
  let cursorY = padTop;
  let rowH = 0;
  const placed: WireframeElement[] = [];
  for (const child of children) {
    const sizing = readChildSizing(child);
    let { w, h } = childMeasure(child, sizing);
    if (cursorX + w > padLeft + innerW && cursorX > padLeft) {
      cursorY += rowH + layout.gap;
      cursorX = padLeft;
      rowH = 0;
    }
    placed.push({ ...child, x: snap(cursorX), y: snap(cursorY), w: snap(w), h: snap(h) });
    cursorX += w + layout.gap;
    rowH = Math.max(rowH, h);
  }
  const stackH = layout.sizing === "hug" ? snap(cursorY + rowH + padBottom) : stack.h;
  const stackW = layout.sizing === "hug" ? snap(innerW + padLeft + padRight) : stack.w;
  return { stack: { ...stack, w: stackW, h: stackH }, children: placed };
}

export function layoutStack(
  stack: WireframeElement,
  children: readonly WireframeElement[],
): { stack: WireframeElement; children: WireframeElement[] } {
  const layout = readStackLayout(stack);
  const ordered = [...children];
  if (layout.direction === "horizontal") return layoutHorizontal(stack, layout, ordered);
  if (layout.direction === "wrap") return layoutWrap(stack, layout, ordered);
  return layoutVertical(stack, layout, ordered);
}

export function applyConstraints(
  parentBefore: { w: number; h: number },
  parentAfter: { w: number; h: number },
  child: WireframeElement,
  constraints: ElementConstraints,
): Pick<WireframeElement, "x" | "y" | "w" | "h"> {
  const dx = parentAfter.w - parentBefore.w;
  const dy = parentAfter.h - parentBefore.h;
  let { x, y, w, h } = child;
  switch (constraints.horizontal) {
    case "left":
      break;
    case "right":
      x = snap(x + dx);
      break;
    case "leftRight":
      w = snap(Math.max(SNAP, w + dx));
      break;
    case "center":
      x = snap(x + dx / 2);
      break;
    case "scale":
      if (parentBefore.w > 0) {
        const ratio = parentAfter.w / parentBefore.w;
        x = snap(x * ratio);
        w = snap(Math.max(SNAP, w * ratio));
      }
      break;
  }
  switch (constraints.vertical) {
    case "top":
      break;
    case "bottom":
      y = snap(y + dy);
      break;
    case "topBottom":
      h = snap(Math.max(SNAP, h + dy));
      break;
    case "center":
      y = snap(y + dy / 2);
      break;
    case "scale":
      if (parentBefore.h > 0) {
        const ratio = parentAfter.h / parentBefore.h;
        y = snap(y * ratio);
        h = snap(Math.max(SNAP, h * ratio));
      }
      break;
  }
  return { x, y, w, h };
}

export function wrapSelectionInStack(
  elements: readonly WireframeElement[],
  selectedIds: readonly string[],
): { elements: WireframeElement[]; stackId: string } {
  const selected = elements.filter((el) => selectedIds.includes(el.id));
  if (!selected.length) throw new Error("empty selection");
  const abs = selected.map((el) => ({ el, ...absolutePosition(el, elements) }));
  const minX = Math.min(...abs.map((item) => item.x));
  const minY = Math.min(...abs.map((item) => item.y));
  const maxX = Math.max(...abs.map((item) => item.x + item.el.w));
  const maxY = Math.max(...abs.map((item) => item.y + item.el.h));
  const stack = writeStackLayout(
    {
      ...defaultElement("Container", minX, minY, elements),
      id: newElementId(),
      label: "Stack",
      w: snap(maxX - minX),
      h: snap(maxY - minY),
    },
    defaultStackLayout(),
  );
  const selectedSet = new Set(selectedIds);
  const next = elements
    .map((el) => {
      if (!selectedSet.has(el.id)) return el;
      const pos = absolutePosition(el, elements);
      return {
        ...el,
        parentId: stack.id,
        parentState: undefined,
        x: snap(pos.x - minX),
        y: snap(pos.y - minY),
      };
    })
    .concat(stack);
  return { elements: relayoutPageStacks(next), stackId: stack.id };
}

export function reorderStackChild(elements: readonly WireframeElement[], stackId: string, childId: string, toIndex: number): WireframeElement[] {
  const siblings = childrenOf(elements, stackId);
  const fromIndex = siblings.findIndex((el) => el.id === childId);
  if (fromIndex < 0) return [...elements];
  const reordered = [...siblings];
  const [moved] = reordered.splice(fromIndex, 1);
  if (!moved) return [...elements];
  reordered.splice(Math.max(0, Math.min(toIndex, reordered.length)), 0, moved);
  const siblingIds = new Set(siblings.map((el) => el.id));
  const without = elements.filter((el) => !siblingIds.has(el.id));
  return relayoutPageStacks([...without, ...reordered]);
}

function patchElements(elements: readonly WireframeElement[], patches: Map<string, WireframeElement>): WireframeElement[] {
  return elements.map((el) => patches.get(el.id) ?? el);
}

export function relayoutPageStacks(elements: readonly WireframeElement[]): WireframeElement[] {
  let next = [...elements];
  const stacks = next.filter(isAutoLayoutStack);
  const depth = (id: string): number => {
    let d = 0;
    let parent = readParent(next.find((el) => el.id === id)!);
    while (parent) {
      d += 1;
      const node = next.find((el) => el.id === parent!.id);
      parent = node ? readParent(node) : null;
    }
    return d;
  };
  stacks.sort((a, b) => depth(b.id) - depth(a.id));
  for (const stack of stacks) {
    const kids = childrenOf(next, stack.id);
    if (!kids.length) continue;
    const result = layoutStack(stack, kids);
    const patches = new Map<string, WireframeElement>(result.children.map((el) => [el.id, el]));
    patches.set(stack.id, result.stack);
    next = patchElements(next, patches);
  }
  return next;
}

export function viewCanvasSize(view: PageDeviceView, base: WireframePage["canvas"]): WireframePage["canvas"] {
  if (view === "desktop") return base;
  const preset = view === "tablet" ? CANVAS_PRESETS.tablet : CANVAS_PRESETS.phone;
  return { ...base, width: preset.width, height: preset.height };
}

export function resolvePageView(page: WireframePage, view: PageDeviceView): WireframePage {
  const canvas = viewCanvasSize(view, page.canvas);
  if (view === "desktop") return { ...page, canvas };
  const data = page.views?.[view];
  if (!data) return { ...page, canvas };
  let elements = page.elements.map((el) => ({ ...el }));
  if (data.elements) {
    elements = elements.map((el) => {
      const patch = data.elements![el.id];
      if (!patch) return el;
      return {
        ...el,
        ...("x" in patch ? { x: patch.x! } : {}),
        ...("y" in patch ? { y: patch.y! } : {}),
        ...("w" in patch ? { w: patch.w! } : {}),
        ...("h" in patch ? { h: patch.h! } : {}),
        ...("hidden" in patch ? { hidden: patch.hidden } : {}),
        ...(patch.props ? { props: { ...el.props, ...patch.props } } : {}),
      };
    });
  }
  return {
    ...page,
    canvas: { ...canvas, ...(data.canvas ?? {}) },
    elements: relayoutPageStacks(elements),
  };
}

export function stackFlexStyle(stack: WireframeElement): Record<string, string | number> {
  const layout = readStackLayout(stack);
  const [top, right, bottom, left] = layout.padding;
  return {
    display: "flex",
    flexDirection: layout.direction === "horizontal" ? "row" : "column",
    flexWrap: layout.direction === "wrap" ? "wrap" : "nowrap",
    gap: layout.gap,
    padding: `${top}px ${right}px ${bottom}px ${left}px`,
    alignItems: layout.align === "stretch" ? "stretch" : layout.align,
    justifyContent: layout.justify === "space-between" ? "space-between" : layout.justify,
  };
}

export function applyConstraintsToChildren(
  elements: readonly WireframeElement[],
  parentId: string,
  parentBefore: { w: number; h: number },
  parentAfter: { w: number; h: number },
): WireframeElement[] {
  return elements.map((el) => {
    const parent = readParent(el);
    if (parent?.id !== parentId) return el;
    const constraints = readConstraints(el);
    if (!constraints) return el;
    return { ...el, ...applyConstraints(parentBefore, parentAfter, el, constraints) };
  });
}

export function mergePageElementsForView(page: WireframePage, view: PageDeviceView, elements: readonly WireframeElement[]): WireframePage {
  const laid = relayoutPageStacks([...elements]);
  if (view === "desktop") return { ...page, elements: laid };
  return {
    ...page,
    views: {
      ...(page.views ?? {}),
      [view]: captureViewOverride(page, view, laid),
    },
  };
}

export function captureViewOverride(page: WireframePage, view: PageDeviceView, elements: readonly WireframeElement[]): PageViewData {
  const base = resolvePageView({ ...page, views: undefined }, "desktop").elements;
  const overrides: Record<string, ElementViewOverride> = {};
  for (const el of elements) {
    const orig = base.find((item) => item.id === el.id);
    if (!orig) continue;
    const patch: ElementViewOverride = {};
    if (el.x !== orig.x) patch.x = el.x;
    if (el.y !== orig.y) patch.y = el.y;
    if (el.w !== orig.w) patch.w = el.w;
    if (el.h !== orig.h) patch.h = el.h;
    if (el.hidden !== orig.hidden) patch.hidden = el.hidden;
    if (Object.keys(patch).length) overrides[el.id] = patch;
  }
  return {
    canvas: viewCanvasSize(view, page.canvas),
    elements: overrides,
  };
}

export function turnContainerIntoStack(el: WireframeElement): WireframeElement {
  if (!STACK_TYPES.has(el.type)) return el;
  return writeStackLayout(el, defaultStackLayout());
}

export type StackLayoutHandleMarker = { key: string; stackHandle: string; x: number; y: number };

export function stackLayoutHandleMarkers(stack: WireframeElement, elements: readonly WireframeElement[]): StackLayoutHandleMarker[] {
  if (!isAutoLayoutStack(stack)) return [];
  const layout = readStackLayout(stack);
  const origin = absolutePosition(stack, elements);
  const kids = childrenOf(elements, stack.id);
  const vertical = layout.direction === "vertical";
  const out: StackLayoutHandleMarker[] = [];
  for (let i = 0; i < kids.length - 1; i++) {
    const a = kids[i]!;
    const b = kids[i + 1]!;
    if (vertical) {
      out.push({
        key: `gap-${i}`,
        stackHandle: `gap:${i}`,
        x: origin.x + stack.w / 2,
        y: origin.y + a.y + a.h + layout.gap / 2,
      });
    } else {
      out.push({
        key: `gap-${i}`,
        stackHandle: `gap:${i}`,
        x: origin.x + a.x + a.w + layout.gap / 2,
        y: origin.y + stack.h / 2,
      });
    }
  }
  const [top, right, bottom, left] = layout.padding;
  out.push({ key: "pad-t", stackHandle: "padding:top", x: origin.x + stack.w / 2, y: origin.y + top / 2 });
  out.push({ key: "pad-r", stackHandle: "padding:right", x: origin.x + stack.w - right / 2, y: origin.y + stack.h / 2 });
  out.push({ key: "pad-b", stackHandle: "padding:bottom", x: origin.x + stack.w / 2, y: origin.y + stack.h - bottom / 2 });
  out.push({ key: "pad-l", stackHandle: "padding:left", x: origin.x + left / 2, y: origin.y + stack.h / 2 });
  return out;
}
