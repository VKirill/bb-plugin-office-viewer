// Nested containers: dynamic panel states, repeater data, parent coordinates.
import { SNAP, snap, type PropValue, type WireframeElement } from "./model.ts";

export type ElementParent = { id: string; state?: string };

export type EditScope =
  | { kind: "page" }
  | { kind: "panel"; panelId: string; state: string }
  | { kind: "container"; containerId: string }
  | { kind: "group"; groupId: string }
  | { kind: "component"; componentId: string; instanceId?: string };

export type OutlineNode = {
  id: string;
  depth: number;
  element: WireframeElement;
  children: OutlineNode[];
};

export type BoardElement = {
  element: WireframeElement;
  absX: number;
  absY: number;
};

const CONTAINER_TYPES = new Set(["Container", "DynamicPanel", "Repeater"]);

export function isContainerType(type: string): boolean {
  return CONTAINER_TYPES.has(type);
}

export function readParent(el: WireframeElement): ElementParent | null {
  const id = el.parentId;
  if (!id) return null;
  const state = typeof el.parentState === "string" && el.parentState ? el.parentState : undefined;
  return { id, state };
}

export function withParent(el: WireframeElement, parent: ElementParent | null): WireframeElement {
  if (!parent) return { ...el, parentId: undefined, parentState: undefined };
  return { ...el, parentId: parent.id, parentState: parent.state };
}

export function elementMap(elements: readonly WireframeElement[]): Map<string, WireframeElement> {
  return new Map(elements.map((el) => [el.id, el]));
}

export function absolutePosition(el: WireframeElement, elements: readonly WireframeElement[]): { x: number; y: number } {
  const byId = elementMap(elements);
  let x = el.x;
  let y = el.y;
  let parent = readParent(el);
  const seen = new Set<string>();
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    const node = byId.get(parent.id);
    if (!node) break;
    x += node.x;
    y += node.y;
    parent = readParent(node);
  }
  return { x, y };
}

export function localizePoint(
  absX: number,
  absY: number,
  parent: WireframeElement,
  elements: readonly WireframeElement[],
): { x: number; y: number } {
  const origin = absolutePosition(parent, elements);
  return { x: snap(absX - origin.x), y: snap(absY - origin.y) };
}

export function rootElements(elements: readonly WireframeElement[]): WireframeElement[] {
  const ids = new Set(elements.map((el) => el.id));
  return elements.filter((el) => {
    const parent = readParent(el);
    return !parent || !ids.has(parent.id);
  });
}

export function childrenOf(
  elements: readonly WireframeElement[],
  parentId: string,
  state?: string,
): WireframeElement[] {
  return elements.filter((el) => {
    const parent = readParent(el);
    if (!parent || parent.id !== parentId) return false;
    if (state === undefined) return true;
    return parent.state === state;
  });
}

export function panelStates(panel: WireframeElement): string[] {
  const raw = panel.props.states;
  if (Array.isArray(raw) && raw.every((item) => typeof item === "string") && raw.length) return [...raw];
  return ["State 1", "State 2"];
}

export function activePanelState(panel: WireframeElement): string {
  const states = panelStates(panel);
  const active = panel.props.active;
  if (typeof active === "string" && states.includes(active)) return active;
  return states[0] ?? "State 1";
}

export function migrateDynamicPanel(panel: WireframeElement): WireframeElement {
  if (panel.type !== "DynamicPanel") return panel;
  const states = panelStates(panel);
  const active = activePanelState(panel);
  return {
    ...panel,
    props: { ...panel.props, states, active, viewAllStates: panel.props.viewAllStates === true },
  };
}

export function repeaterColumns(repeater: WireframeElement): string[] {
  const raw = repeater.props.columns;
  if (Array.isArray(raw) && raw.every((item) => typeof item === "string") && raw.length) return [...raw];
  return ["Col 1", "Col 2"];
}

export function repeaterData(repeater: WireframeElement): string[][] {
  const columns = repeaterColumns(repeater);
  const raw = repeater.props.data;
  if (Array.isArray(raw) && raw.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"))) {
    return normalizeRepeaterData(columns, raw as string[][]);
  }
  const rows = typeof repeater.props.rows === "number" ? Math.max(1, Math.round(repeater.props.rows)) : 3;
  return Array.from({ length: rows }, () => columns.map(() => ""));
}

export function normalizeRepeaterData(columns: readonly string[], data: readonly string[][]): string[][] {
  const width = columns.length;
  return data.map((row) => {
    const cells = [...row];
    while (cells.length < width) cells.push("");
    return cells.slice(0, width);
  });
}

export function parseTsvGrid(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.length > 0);
  return lines.map((line) => line.split("\t"));
}

export function parseCsvGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  pushCell();
  if (row.length > 1 || row[0] !== "" || rows.length === 0) pushRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function applyBindings(text: string, columns: readonly string[], row: readonly string[]): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const name = key.trim();
    const index = columns.findIndex((col) => col === name);
    if (index < 0) return "";
    return row[index] ?? "";
  });
}

function bindingProps(props: Record<string, PropValue>, columns: readonly string[], row: readonly string[]): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string") out[key] = applyBindings(value, columns, row);
    else out[key] = value;
  }
  return out;
}

export function repeaterRowHeight(repeater: WireframeElement, templateChildren: readonly WireframeElement[]): number {
  if (!templateChildren.length) return SNAP * 4;
  const maxBottom = Math.max(...templateChildren.map((el) => el.y + el.h));
  return Math.max(SNAP * 2, snap(maxBottom + SNAP));
}

export function expandRepeaterRow(
  repeater: WireframeElement,
  templateChildren: readonly WireframeElement[],
  rowIndex: number,
  row: readonly string[],
): WireframeElement[] {
  const columns = repeaterColumns(repeater);
  const rowHeight = repeaterRowHeight(repeater, templateChildren);
  const yOffset = rowIndex * rowHeight;
  return templateChildren.map((child) => ({
    ...child,
    id: `${child.id}__r${rowIndex}`,
    y: child.y + yOffset,
    props: bindingProps(child.props, columns, row),
  }));
}

export function migrateRepeater(repeater: WireframeElement): WireframeElement {
  if (repeater.type !== "Repeater") return repeater;
  const columns = repeaterColumns(repeater);
  const data = repeaterData(repeater);
  return { ...repeater, props: { ...repeater.props, columns, data, rows: data.length } };
}

export function normalizePageElements(elements: WireframeElement[]): WireframeElement[] {
  return elements.map((el) => {
    if (el.type === "DynamicPanel") return migrateDynamicPanel(el);
    if (el.type === "Repeater") return migrateRepeater(el);
    return el;
  });
}

export function addPanelState(panel: WireframeElement, name?: string): WireframeElement {
  const states = panelStates(panel);
  let n = states.length + 1;
  let next = name ?? `State ${n}`;
  const used = new Set(states);
  while (used.has(next)) {
    n += 1;
    next = `State ${n}`;
  }
  return { ...panel, props: { ...panel.props, states: [...states, next], active: next } };
}

export function duplicatePanelState(
  panel: WireframeElement,
  state: string,
  elements: readonly WireframeElement[],
): { panel: WireframeElement; elements: WireframeElement[] } {
  const states = panelStates(panel);
  let n = states.length + 1;
  let nextName = `${state} copy`;
  const used = new Set(states);
  while (used.has(nextName)) {
    n += 1;
    nextName = `${state} copy ${n}`;
  }
  const nextPanel = { ...panel, props: { ...panel.props, states: [...states, nextName], active: nextName } };
  const clones = childrenOf(elements, panel.id, state).map((child) => ({
    ...structuredClone(child),
    id: `${child.id}_dup_${Date.now().toString(36)}`,
    parentState: nextName,
  }));
  return { panel: nextPanel, elements: [...elements, ...clones] };
}

export function renamePanelState(
  panel: WireframeElement,
  elements: readonly WireframeElement[],
  from: string,
  to: string,
): WireframeElement[] {
  const states = panelStates(panel).map((name) => (name === from ? to : name));
  const nextPanel = { ...panel, props: { ...panel.props, states, active: activePanelState(panel) === from ? to : panel.props.active } };
  return elements.map((el) => {
    if (el.id === panel.id) return nextPanel;
    const parent = readParent(el);
    if (parent?.id === panel.id && parent.state === from) return { ...el, parentState: to };
    return el;
  });
}

export function deletePanelState(panel: WireframeElement, elements: readonly WireframeElement[], state: string): WireframeElement[] {
  const states = panelStates(panel).filter((name) => name !== state);
  const fallback = states[0] ?? "State 1";
  const nextStates = states.length ? states : [fallback];
  const nextPanel = {
    ...panel,
    props: { ...panel.props, states: nextStates, active: activePanelState(panel) === state ? nextStates[0]! : panel.props.active },
  };
  const drop = new Set(
    elements.filter((el) => {
      const parent = readParent(el);
      return parent?.id === panel.id && parent.state === state;
    }).map((el) => el.id),
  );
  return elements.filter((el) => !drop.has(el.id)).map((el) => (el.id === panel.id ? nextPanel : el));
}

export function orphanChildren(elements: readonly WireframeElement[], deletedIds: ReadonlySet<string>): WireframeElement[] {
  const byId = elementMap(elements);
  return elements.map((el) => {
    const parent = readParent(el);
    if (!parent || !deletedIds.has(parent.id)) return el;
    const origin = byId.get(parent.id);
    if (!origin) return { ...el, parentId: undefined, parentState: undefined };
    const abs = absolutePosition(el, elements);
    const { parentId: _a, parentState: _b, ...rest } = el;
    return { ...rest, x: abs.x, y: abs.y };
  });
}

export function scopeParent(scope: EditScope): ElementParent | null {
  if (scope.kind === "page" || scope.kind === "component") return null;
  if (scope.kind === "panel") return { id: scope.panelId, state: scope.state };
  if (scope.kind === "container") return { id: scope.containerId };
  return null;
}

export function elementsInScope(elements: readonly WireframeElement[], scope: EditScope): WireframeElement[] {
  if (scope.kind === "page") return rootElements(elements);
  if (scope.kind === "component") return [];
  if (scope.kind === "group") return elements.filter((el) => el.groupId === scope.groupId);
  if (scope.kind === "container") return childrenOf(elements, scope.containerId);
  return childrenOf(elements, scope.panelId, scope.state);
}

export function boardElements(elements: readonly WireframeElement[], scope: EditScope): BoardElement[] {
  if (scope.kind === "component") return [];
  const inScope = elementsInScope(elements, scope);
  if (scope.kind === "page") {
    return inScope.map((el) => ({ element: el, absX: el.x, absY: el.y }));
  }
  if (scope.kind === "group") {
    return inScope.map((el) => ({ element: el, absX: el.x, absY: el.y }));
  }
  const parentId = scope.kind === "container" ? scope.containerId : scope.panelId;
  const parent = elements.find((el) => el.id === parentId);
  if (!parent) return [];
  const origin = absolutePosition(parent, elements);
  return inScope.map((el) => ({ element: el, absX: origin.x + el.x, absY: origin.y + el.y }));
}

export function attachToScope(
  el: WireframeElement,
  scope: EditScope,
  absX: number,
  absY: number,
  elements: readonly WireframeElement[],
): WireframeElement {
  if (scope.kind === "component") {
    let ox = SNAP * 2;
    let oy = SNAP * 2;
    if (scope.instanceId) {
      const inst = elements.find((item) => item.id === scope.instanceId);
      if (inst) {
        ox = inst.x;
        oy = inst.y;
      }
    }
    return { ...el, x: snap(absX - ox), y: snap(absY - oy), parentId: undefined, parentState: undefined, groupId: undefined };
  }
  if (scope.kind === "group") {
    return { ...el, x: snap(absX), y: snap(absY), groupId: scope.groupId, parentId: undefined, parentState: undefined };
  }
  const parent = scopeParent(scope);
  if (!parent) return { ...el, x: snap(absX), y: snap(absY), parentId: undefined, parentState: undefined };
  const host = elements.find((item) => item.id === parent.id);
  if (!host) return el;
  const local = localizePoint(absX, absY, host, elements);
  return { ...el, ...local, parentId: parent.id, parentState: parent.state };
}

export function enterScopeForElement(el: WireframeElement, elements: readonly WireframeElement[]): EditScope | null {
  if (el.type === "Instance") {
    const componentId = el.props.componentId;
    if (typeof componentId === "string" && componentId) return { kind: "component", componentId, instanceId: el.id };
    return null;
  }
  if (el.type === "DynamicPanel") return { kind: "panel", panelId: el.id, state: activePanelState(el) };
  if (el.type === "Container" || el.type === "Repeater") return { kind: "container", containerId: el.id };
  if (el.groupId) return { kind: "group", groupId: el.groupId };
  return null;
}

export function outlineTree(elements: readonly WireframeElement[]): OutlineNode[] {
  const roots = rootElements(elements);
  const build = (el: WireframeElement, depth: number): OutlineNode => {
    let kids: WireframeElement[] = [];
    if (el.type === "DynamicPanel") {
      const state = activePanelState(el);
      kids = childrenOf(elements, el.id, state);
    } else if (isContainerType(el.type)) {
      kids = childrenOf(elements, el.id);
    }
    return {
      id: el.id,
      depth,
      element: el,
      children: kids.map((child) => build(child, depth + 1)),
    };
  };
  return roots.map((el) => build(el, 0));
}

export function flattenOutline(nodes: readonly OutlineNode[]): { element: WireframeElement; depth: number }[] {
  const out: { element: WireframeElement; depth: number }[] = [];
  const walk = (list: readonly OutlineNode[]) => {
    for (const node of list) {
      out.push({ element: node.element, depth: node.depth });
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function panelViewAllStates(panel: WireframeElement): boolean {
  return panel.props.viewAllStates === true;
}

export function setPanelViewAllStates(panel: WireframeElement, on: boolean): WireframeElement {
  return { ...panel, props: { ...panel.props, viewAllStates: on } };
}
