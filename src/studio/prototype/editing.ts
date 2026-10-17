// Pure inline-edit helpers: draft apply, Enter adds the next radio/item, radio groups.
import { defaultElement, type ElementType, type WireframeElement } from "./model.ts";

export type ItemKey = "items" | "options" | "states";

export type InlineTarget = { kind: "prop"; key: string } | { kind: "item"; key: ItemKey; index: number };

export type InlineEdit = {
  id: string;
  target: InlineTarget;
  draft: string;
};

const SIMPLE_KEY: Partial<Record<ElementType, string>> = {
  Button: "text",
  Text: "text",
  Heading: "text",
  Header: "text",
  TextField: "placeholder",
  TextArea: "placeholder",
  Card: "title",
  Modal: "title",
  Checkbox: "text",
  Radio: "text",
  Box: "text",
  Ellipse: "text",
  Placeholder: "text",
  Label: "text",
  Paragraph: "text",
  Sticky: "text",
  Shape: "text",
  Alert: "title",
  Tooltip: "text",
  SearchField: "placeholder",
};

const LIST_KEY: Partial<Record<ElementType, ItemKey>> = {
  List: "items",
  Nav: "items",
  Tabs: "items",
  ChoicePicker: "options",
  ListBox: "items",
  Menu: "items",
  Breadcrumbs: "items",
  Tree: "items",
  DynamicPanel: "states",
};

function textOrientation(el: WireframeElement): string {
  const value = el.props.orientation;
  return typeof value === "string" ? value : "horizontal";
}

let nextGroup = 0;

export function newGroupId(): string {
  return `grp_${Date.now().toString(36)}_${(++nextGroup).toString(36)}`;
}

export function simpleEditKey(type: ElementType): string | null {
  return SIMPLE_KEY[type] ?? null;
}

export function itemListKey(type: ElementType): ItemKey | null {
  return LIST_KEY[type] ?? null;
}

export function stringList(el: WireframeElement, key: ItemKey): string[] {
  const value = el.props[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [];
}

export function readDraft(el: WireframeElement, target: InlineTarget): string {
  if (target.kind === "prop") {
    const value = el.props[target.key];
    return typeof value === "string" ? value : "";
  }
  return stringList(el, target.key)[target.index] ?? "";
}

export function draftUnchanged(el: WireframeElement, edit: InlineEdit): boolean {
  return readDraft(el, edit.target) === edit.draft;
}

export function applyInlineDraft(el: WireframeElement, edit: InlineEdit): WireframeElement {
  if (edit.target.kind === "prop") {
    return { ...el, props: { ...el.props, [edit.target.key]: edit.draft } };
  }
  const items = stringList(el, edit.target.key);
  const previous = items[edit.target.index];
  items[edit.target.index] = edit.draft;
  const props = { ...el.props, [edit.target.key]: items };
  if (el.type === "Tabs" && el.props.active === previous) props.active = edit.draft;
  if (el.type === "ChoicePicker" && el.props.value === previous) props.value = edit.draft;
  if (el.type === "DynamicPanel" && el.props.active === previous) props.active = edit.draft;
  if (el.type === "ListBox" && el.props.selected === previous) props.selected = edit.draft;
  return { ...el, props };
}

export function enterOnListItem(el: WireframeElement, key: ItemKey, index: number, draft: string): { element: WireframeElement; nextIndex: number } {
  const updated = applyInlineDraft(el, { id: el.id, target: { kind: "item", key, index }, draft });
  const items = stringList(updated, key);
  items.splice(index + 1, 0, "");
  return { element: { ...updated, props: { ...updated.props, [key]: items } }, nextIndex: index + 1 };
}

export function removeEmptyListItem(el: WireframeElement, key: ItemKey, index: number): { element: WireframeElement; nextIndex: number | null } {
  const items = stringList(el, key);
  if (items.length <= 1) return { element: { ...el, props: { ...el.props, [key]: [""] } }, nextIndex: 0 };
  items.splice(index, 1);
  return { element: { ...el, props: { ...el.props, [key]: items } }, nextIndex: Math.min(index, items.length - 1) };
}

export function shareRadioGroup(source: WireframeElement, next: WireframeElement): { source: WireframeElement; next: WireframeElement } {
  const group = typeof source.props.group === "string" && source.props.group ? source.props.group : newGroupId();
  return {
    source: { ...source, props: { ...source.props, group } },
    next: { ...next, props: { ...next.props, group } },
  };
}

export function addChoiceSibling(elements: readonly WireframeElement[], id: string, draft: string): { elements: WireframeElement[]; edit: InlineEdit } {
  const source = elements.find((el) => el.id === id);
  if (!source || (source.type !== "Radio" && source.type !== "Checkbox")) {
    throw new Error(`Expected a Radio or Checkbox: ${id}`);
  }
  let updated = applyInlineDraft(source, { id, target: { kind: "prop", key: "text" }, draft });
  let created = defaultElement(source.type, source.x, source.y + source.h, elements.map((el) => (el.id === id ? updated : el)));
  created = { ...created, w: source.w, h: source.h, props: { ...created.props, text: "", checked: false } };
  if (source.type === "Radio") {
    const paired = shareRadioGroup(updated, created);
    updated = paired.source;
    created = paired.next;
  }
  return {
    elements: [...elements.map((el) => (el.id === id ? updated : el)), created],
    edit: { id: created.id, target: { kind: "prop", key: "text" }, draft: "" },
  };
}

export function checkRadio(elements: readonly WireframeElement[], id: string): WireframeElement[] {
  const target = elements.find((el) => el.id === id);
  if (!target || target.type !== "Radio") return [...elements];
  const group = typeof target.props.group === "string" ? target.props.group : "";
  return elements.map((el) => {
    if (el.id === id) return { ...el, props: { ...el.props, checked: true } };
    if (el.type === "Radio" && group && el.props.group === group) return { ...el, props: { ...el.props, checked: false } };
    return el;
  });
}

export function toggleCheckbox(elements: readonly WireframeElement[], id: string): WireframeElement[] {
  return elements.map((el) => (el.id === id && el.type === "Checkbox" ? { ...el, props: { ...el.props, checked: el.props.checked !== true } } : el));
}

export function itemIndexAt(el: WireframeElement, localX: number, localY: number): number {
  const key = itemListKey(el.type);
  if (!key) return 0;
  const items = stringList(el, key);
  if (items.length === 0) return 0;
  if (el.type === "ChoicePicker") {
    const value = typeof el.props.value === "string" ? el.props.value : "";
    const found = items.indexOf(value);
    return found >= 0 ? found : 0;
  }
  const horizontal =
    el.type === "Nav" || el.type === "Tabs" || (el.type === "Menu" && textOrientation(el) !== "vertical");
  const span = horizontal ? el.w / items.length : el.h / items.length;
  const along = horizontal ? localX : localY;
  return Math.max(0, Math.min(items.length - 1, Math.floor(along / Math.max(1, span))));
}
