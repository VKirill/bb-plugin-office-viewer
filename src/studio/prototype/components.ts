// Document components (masters) and Instance elements with overrides.
import { absolutePosition } from "./containers.ts";
import { simpleEditKey } from "./editing.ts";
import {
  SNAP,
  newElementId,
  nextLabel,
  snap,
  type ElementType,
  type PropValue,
  type Wireframe,
  type WireframeComponent,
  type WireframeElement,
} from "./model.ts";

export const COMPONENT_DRAG_PREFIX = "proto-component:";

export function newComponentId(): string {
  return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function isInstance(el: WireframeElement): boolean {
  return el.type === "Instance";
}

export function instanceComponentId(el: WireframeElement): string {
  if (!isInstance(el)) return "";
  const value = el.props.componentId;
  return typeof value === "string" ? value : "";
}

export function findComponent(doc: Wireframe, componentId: string): WireframeComponent | null {
  return (doc.components ?? []).find((item) => item.id === componentId) ?? null;
}

export function componentBounds(elements: readonly WireframeElement[]): { x: number; y: number; w: number; h: number } {
  if (!elements.length) return { x: 0, y: 0, w: SNAP * 4, h: SNAP * 3 };
  const left = Math.min(...elements.map((el) => el.x));
  const top = Math.min(...elements.map((el) => el.y));
  const right = Math.max(...elements.map((el) => el.x + el.w));
  const bottom = Math.max(...elements.map((el) => el.y + el.h));
  return { x: left, y: top, w: Math.max(SNAP, snap(right - left)), h: Math.max(SNAP, snap(bottom - top)) };
}

export function readOverrides(instance: WireframeElement): Map<string, string> {
  const map = new Map<string, string>();
  const raw = instance.props.overrides;
  if (!Array.isArray(raw)) return map;
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 3) continue;
    const [elId, key, value] = row;
    if (typeof elId === "string" && typeof key === "string" && typeof value === "string") {
      map.set(`${elId}\0${key}`, value);
    }
  }
  return map;
}

export function overridesToProp(map: Map<string, string>): string[][] {
  return [...map.entries()].map(([compound, value]) => {
    const [elId, key] = compound.split("\0");
    return [elId!, key!, value];
  });
}

export function setOverride(instance: WireframeElement, masterElementId: string, propKey: string, value: string): WireframeElement {
  const map = readOverrides(instance);
  map.set(`${masterElementId}\0${propKey}`, value);
  return { ...instance, props: { ...instance.props, overrides: overridesToProp(map) } };
}

export function clearOverride(instance: WireframeElement, masterElementId: string, propKey: string): WireframeElement {
  const map = readOverrides(instance);
  map.delete(`${masterElementId}\0${propKey}`);
  return { ...instance, props: { ...instance.props, overrides: overridesToProp(map) } };
}

export function resetOverrides(instance: WireframeElement): WireframeElement {
  const { overrides: _o, ...rest } = instance.props;
  return { ...instance, props: rest };
}

export function applyOverridesToElement(master: WireframeElement, instance: WireframeElement): WireframeElement {
  const overrides = readOverrides(instance);
  const props = { ...master.props };
  for (const [compound, value] of overrides) {
    const [elId, key] = compound.split("\0");
    if (elId === master.id && key) props[key] = value;
  }
  return { ...master, props };
}

function instanceScale(instance: WireframeElement, component: WireframeComponent): { sx: number; sy: number } {
  const scaleX = instance.w / Math.max(component.w, 1);
  const scaleY = instance.h / Math.max(component.h, 1);
  return {
    sx: Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
    sy: Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1,
  };
}

export function instanceChildrenForRender(instance: WireframeElement, component: WireframeComponent): WireframeElement[] {
  const { sx, sy } = instanceScale(instance, component);
  return component.elements.map((master) => {
    const merged = applyOverridesToElement(master, instance);
    return {
      ...merged,
      id: `${instance.id}__${master.id}`,
      x: snap(merged.x * sx),
      y: snap(merged.y * sy),
      w: Math.max(SNAP / 2, snap(merged.w * sx)),
      h: Math.max(SNAP / 2, snap(merged.h * sy)),
      parentId: undefined,
      parentState: undefined,
    };
  });
}

export function materializeInstance(instance: WireframeElement, component: WireframeComponent): WireframeElement[] {
  return instanceChildrenForRender(instance, component).map((el) => ({
    ...el,
    x: snap(instance.x + el.x),
    y: snap(instance.y + el.y),
  }));
}

export function overridableTextKeys(el: WireframeElement): string[] {
  const key = simpleEditKey(el.type);
  return key ? [key] : [];
}

export function listInstanceOverrides(
  instance: WireframeElement,
  component: WireframeComponent,
): { elementId: string; elementLabel: string; propKey: string; value: string; masterValue: string }[] {
  const overrides = readOverrides(instance);
  const rows: { elementId: string; elementLabel: string; propKey: string; value: string; masterValue: string }[] = [];
  for (const master of component.elements) {
    for (const propKey of overridableTextKeys(master)) {
      const masterValue = typeof master.props[propKey] === "string" ? master.props[propKey] : "";
      const value = overrides.get(`${master.id}\0${propKey}`) ?? masterValue;
      rows.push({ elementId: master.id, elementLabel: master.label, propKey, value, masterValue });
    }
  }
  return rows;
}

export function collectSelectionForComponent(pageElements: readonly WireframeElement[], selectedIds: readonly string[]): WireframeElement[] {
  const pick = new Set(selectedIds);
  const chosen = pageElements.filter((el) => pick.has(el.id) && !isInstance(el));
  if (!chosen.length) return [];
  const chosenIds = new Set(chosen.map((el) => el.id));
  return chosen.filter((el) => {
    if (!el.parentId) return true;
    return !chosenIds.has(el.parentId);
  });
}

export function cloneElementsToMaster(
  pageElements: readonly WireframeElement[],
  selected: readonly WireframeElement[],
): { elements: WireframeElement[]; w: number; h: number } {
  const ids = new Set(selected.map((el) => el.id));
  const absEntries = selected.map((el) => ({ el, abs: absolutePosition(el, pageElements) }));
  const left = Math.min(...absEntries.map((item) => item.abs.x));
  const top = Math.min(...absEntries.map((item) => item.abs.y));
  const right = Math.max(...absEntries.map((item) => item.abs.x + item.el.w));
  const bottom = Math.max(...absEntries.map((item) => item.abs.y + item.el.h));
  const w = Math.max(SNAP, snap(right - left));
  const h = Math.max(SNAP, snap(bottom - top));
  const idMap = new Map<string, string>();
  const elements = selected.map((el) => {
    const nextId = newElementId();
    idMap.set(el.id, nextId);
    const abs = absolutePosition(el, pageElements);
    return {
      ...structuredClone(el),
      id: nextId,
      x: snap(abs.x - left),
      y: snap(abs.y - top),
      parentId: el.parentId && ids.has(el.parentId) ? idMap.get(el.parentId) : undefined,
      parentState: el.parentId && ids.has(el.parentId) ? el.parentState : undefined,
    };
  });
  return { elements, w, h };
}

export function createComponentFromSelection(
  doc: Wireframe,
  pageElements: WireframeElement[],
  selectedIds: readonly string[],
  name?: string,
): { doc: Wireframe; instance: WireframeElement } | null {
  const selected = collectSelectionForComponent(pageElements, selectedIds);
  if (!selected.length) return null;
  const { elements, w, h } = cloneElementsToMaster(pageElements, selected);
  const componentId = newComponentId();
  const componentName = name ?? `Component ${(doc.components?.length ?? 0) + 1}`;
  const component: WireframeComponent = { id: componentId, name: componentName, w, h, elements };
  const left = Math.min(...selected.map((el) => absolutePosition(el, pageElements).x));
  const top = Math.min(...selected.map((el) => absolutePosition(el, pageElements).y));
  const remove = new Set(selected.map((el) => el.id));
  const remaining = pageElements.filter((el) => !remove.has(el.id));
  const instance: WireframeElement = {
    id: newElementId(),
    type: "Instance",
    label: nextLabel("Instance" as ElementType, [...pageElements, ...remaining]),
    x: snap(left),
    y: snap(top),
    w,
    h,
    props: { componentId },
  };
  return {
    doc: { ...doc, components: [...(doc.components ?? []), component] },
    instance,
  };
}

export function createInstanceFromComponent(
  doc: Wireframe,
  componentId: string,
  x: number,
  y: number,
  existing: readonly WireframeElement[],
): WireframeElement | null {
  const component = findComponent(doc, componentId);
  if (!component) return null;
  return {
    id: newElementId(),
    type: "Instance",
    label: nextLabel("Instance", existing),
    x: snap(x),
    y: snap(y),
    w: component.w,
    h: component.h,
    props: { componentId },
  };
}

export function detachInstance(
  instance: WireframeElement,
  component: WireframeComponent,
): WireframeElement[] {
  return materializeInstance(instance, component).map((el) => ({
    ...el,
    id: newElementId(),
    label: el.label.replace(/^Instance copy/, el.type),
  }));
}

export function countInstances(doc: Wireframe, componentId: string): number {
  let count = 0;
  for (const page of doc.pages) {
    for (const el of page.elements) {
      if (isInstance(el) && instanceComponentId(el) === componentId) count += 1;
    }
  }
  return count;
}

export function removeComponent(doc: Wireframe, componentId: string): Wireframe {
  return { ...doc, components: (doc.components ?? []).filter((item) => item.id !== componentId) };
}

export function purgeComponent(doc: Wireframe, componentId: string): Wireframe {
  const next = removeComponent(doc, componentId);
  return {
    ...next,
    pages: next.pages.map((page) => ({
      ...page,
      elements: page.elements.filter((el) => !(isInstance(el) && instanceComponentId(el) === componentId)),
    })),
  };
}

export function updateComponentElements(doc: Wireframe, componentId: string, elements: WireframeElement[]): Wireframe {
  const bounds = componentBounds(elements);
  return {
    ...doc,
    components: (doc.components ?? []).map((item) =>
      item.id === componentId ? { ...item, elements, w: bounds.w, h: bounds.h } : item,
    ),
  };
}

export function syncInstanceDimensions(doc: Wireframe): Wireframe {
  const components = doc.components ?? [];
  if (!components.length) return doc;
  const byId = new Map(components.map((item) => [item.id, item]));
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      elements: page.elements.map((el) => {
        if (!isInstance(el)) return el;
        const component = byId.get(instanceComponentId(el));
        if (!component) return el;
        return { ...el, w: component.w, h: component.h };
      }),
    })),
  };
}

export function filterComponents(query: string, components: readonly WireframeComponent[]): WireframeComponent[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...components];
  return components.filter((item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
}

export function defaultInstanceProps(componentId: string): Record<string, PropValue> {
  return { componentId };
}

export function componentScopeOrigin(
  scope: { instanceId?: string },
  pageElements: readonly WireframeElement[],
): { x: number; y: number } {
  if (scope.instanceId) {
    const inst = pageElements.find((el) => el.id === scope.instanceId);
    if (inst) return { x: inst.x, y: inst.y };
  }
  return { x: SNAP * 2, y: SNAP * 2 };
}

export function boardElementsForComponent(
  pageElements: readonly WireframeElement[],
  scope: { instanceId?: string },
  componentElements: readonly WireframeElement[],
): { element: WireframeElement; absX: number; absY: number }[] {
  const { x: ox, y: oy } = componentScopeOrigin(scope, pageElements);
  return componentElements.map((el) => ({ element: el, absX: ox + el.x, absY: oy + el.y }));
}

export function applyComponentFromSelection(
  doc: Wireframe,
  pageElements: WireframeElement[],
  selectedIds: readonly string[],
  name?: string,
): { doc: Wireframe; elements: WireframeElement[] } | null {
  const result = createComponentFromSelection(doc, pageElements, selectedIds, name);
  if (!result) return null;
  const remove = new Set(collectSelectionForComponent(pageElements, selectedIds).map((el) => el.id));
  const elements = [...pageElements.filter((el) => !remove.has(el.id)), result.instance];
  return { doc: result.doc, elements };
}
