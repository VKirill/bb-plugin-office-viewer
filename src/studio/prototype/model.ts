// Wireframe document: A2UI-style elements, 8px snap, parse/create helpers.
import { z } from "zod";

export const WIREFRAME_FORMAT = "bb-wireframe" as const;
export const WIREFRAME_VERSION = 1;
export const SNAP = 8;

export const ELEMENT_TYPES = [
  "Header",
  "Nav",
  "Text",
  "Heading",
  "Button",
  "TextField",
  "TextArea",
  "ChoicePicker",
  "Checkbox",
  "Radio",
  "Switch",
  "Slider",
  "Card",
  "Image",
  "Avatar",
  "Icon",
  "Badge",
  "Table",
  "List",
  "Tabs",
  "Modal",
  "Divider",
  "Container",
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];
export type PaletteGroup = "layout" | "inputs" | "content" | "navigation";
export type PropValue = string | number | boolean | string[];

export type WireframeElement = {
  id: string;
  type: ElementType;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, PropValue>;
  note?: string;
};

export type Wireframe = {
  format: typeof WIREFRAME_FORMAT;
  version: typeof WIREFRAME_VERSION;
  name: string;
  canvas: { width: number; height: number; background: string };
  elements: WireframeElement[];
};

export type CatalogEntry = {
  type: ElementType;
  group: PaletteGroup;
  w: number;
  h: number;
  props: Record<string, PropValue>;
};

export const CANVAS_PRESETS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 375, height: 812 },
} as const;

export const CATALOG: readonly CatalogEntry[] = [
  { type: "Container", group: "layout", w: 240, h: 160, props: {} },
  { type: "Card", group: "layout", w: 200, h: 144, props: { title: "Card", text: "Description" } },
  { type: "Modal", group: "layout", w: 320, h: 200, props: { title: "Modal", text: "Content" } },
  { type: "Divider", group: "layout", w: 200, h: 8, props: {} },
  { type: "TextField", group: "inputs", w: 200, h: 40, props: { placeholder: "Placeholder", value: "" } },
  { type: "TextArea", group: "inputs", w: 200, h: 80, props: { placeholder: "Placeholder", value: "" } },
  { type: "ChoicePicker", group: "inputs", w: 200, h: 40, props: { options: ["Option 1", "Option 2"], value: "Option 1" } },
  { type: "Checkbox", group: "inputs", w: 160, h: 32, props: { text: "Checkbox", checked: false } },
  { type: "Radio", group: "inputs", w: 160, h: 32, props: { text: "Radio", checked: false } },
  { type: "Switch", group: "inputs", w: 144, h: 32, props: { text: "Switch", checked: false } },
  { type: "Slider", group: "inputs", w: 200, h: 32, props: { value: 50, min: 0, max: 100 } },
  { type: "Header", group: "content", w: 1280, h: 56, props: { text: "Header" } },
  { type: "Heading", group: "content", w: 240, h: 40, props: { text: "Heading", level: 1 } },
  { type: "Text", group: "content", w: 200, h: 40, props: { text: "Text" } },
  { type: "Button", group: "content", w: 120, h: 40, props: { text: "Button", variant: "default" } },
  { type: "Image", group: "content", w: 160, h: 120, props: { alt: "Image" } },
  { type: "Avatar", group: "content", w: 40, h: 40, props: { initials: "AB" } },
  { type: "Icon", group: "content", w: 32, h: 32, props: { name: "Star" } },
  { type: "Badge", group: "content", w: 64, h: 24, props: { text: "Badge" } },
  { type: "Table", group: "content", w: 320, h: 160, props: { columns: 3, rows: 3 } },
  { type: "List", group: "content", w: 200, h: 160, props: { items: ["Item 1", "Item 2", "Item 3"] } },
  { type: "Nav", group: "navigation", w: 240, h: 40, props: { items: ["Home", "About", "Contact"] } },
  { type: "Tabs", group: "navigation", w: 240, h: 40, props: { items: ["Tab 1", "Tab 2"], active: "Tab 1" } },
];

export const CATALOG_BY_TYPE: Record<ElementType, CatalogEntry> = Object.fromEntries(CATALOG.map((entry) => [entry.type, entry])) as Record<ElementType, CatalogEntry>;

const propValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.string())]);

const elementSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: z.enum(ELEMENT_TYPES),
    label: z.string().min(1).max(200),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().positive().max(8192),
    h: z.number().positive().max(8192),
    props: z.record(z.string(), propValueSchema),
    note: z.string().max(4000).optional(),
  })
  .strict();

const wireframeSchema = z
  .object({
    format: z.literal(WIREFRAME_FORMAT),
    version: z.literal(WIREFRAME_VERSION),
    name: z.string().min(1).max(200),
    canvas: z
      .object({
        width: z.number().int().min(1).max(8192),
        height: z.number().int().min(1).max(8192),
        background: z.string().min(1).max(64),
      })
      .strict(),
    elements: z.array(elementSchema).max(2000),
  })
  .strict();

let nextId = 0;

export function newElementId(): string {
  return `el_${Date.now().toString(36)}_${(++nextId).toString(36)}`;
}

export function snap(v: number, grid = SNAP): number {
  return Math.round(v / grid) * grid;
}

export function nextLabel(type: ElementType, existing: readonly { label: string }[]): string {
  const used = new Set(existing.map((item) => item.label));
  let n = 1;
  while (used.has(`${type} ${n}`)) n += 1;
  return `${type} ${n}`;
}

export function defaultElement(type: ElementType, x: number, y: number, existing: readonly WireframeElement[] = []): WireframeElement {
  const spec = CATALOG_BY_TYPE[type];
  return {
    id: newElementId(),
    type,
    label: nextLabel(type, existing),
    x: snap(x),
    y: snap(y),
    w: spec.w,
    h: spec.h,
    props: structuredClone(spec.props),
  };
}

export function newWireframe(name = "Untitled"): Wireframe {
  return {
    format: WIREFRAME_FORMAT,
    version: WIREFRAME_VERSION,
    name,
    canvas: { ...CANVAS_PRESETS.desktop, background: "#ffffff" },
    elements: [],
  };
}

export function parseWireframe(input: unknown): Wireframe {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  return wireframeSchema.parse(raw);
}

export function cloneWireframe(doc: Wireframe): Wireframe {
  return structuredClone(doc);
}
