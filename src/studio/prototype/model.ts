// Wireframe document: pages (v2), 8px snap, parse/create helpers.
import { z } from "zod";

export const WIREFRAME_FORMAT = "bb-wireframe" as const;
export const WIREFRAME_VERSION = 2;
export const WIREFRAME_VERSION_LEGACY = 1;
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
  "Box",
  "Ellipse",
  "Placeholder",
  "Label",
  "Paragraph",
  "Line",
  "DynamicPanel",
  "Repeater",
  "HotSpot",
  "InlineFrame",
  "Snapshot",
  "ListBox",
  "SearchField",
  "DatePicker",
  "FileUpload",
  "Tree",
  "Menu",
  "Breadcrumbs",
  "Pagination",
  "Progress",
  "Alert",
  "Tooltip",
  "Arrow",
  "Sticky",
  "Marker",
  "Shape",
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];
export type PaletteGroup = "common" | "dynamic" | "forms" | "menus" | "content" | "markup" | "flow";
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
  hidden?: boolean;
  locked?: boolean;
};

export type WireframeCanvas = { width: number; height: number; background: string };

export type WireframePage = {
  id: string;
  name: string;
  canvas: WireframeCanvas;
  elements: WireframeElement[];
  notes?: string;
};

export type Wireframe = {
  format: typeof WIREFRAME_FORMAT;
  version: typeof WIREFRAME_VERSION;
  name: string;
  pages: WireframePage[];
  activePageId: string;
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
  { type: "Box", group: "common", w: 160, h: 96, props: { fill: "none", border: true, radius: 0, text: "" } },
  { type: "Ellipse", group: "common", w: 120, h: 80, props: { fill: "light", border: true, text: "" } },
  { type: "Placeholder", group: "common", w: 160, h: 120, props: { text: "Placeholder" } },
  { type: "Label", group: "common", w: 80, h: 24, props: { text: "Label" } },
  { type: "Paragraph", group: "common", w: 200, h: 64, props: { text: "Paragraph" } },
  { type: "Line", group: "common", w: 160, h: 8, props: { orientation: "horizontal", stroke: "#333333", dashed: false } },
  { type: "Container", group: "common", w: 240, h: 160, props: {} },
  { type: "Card", group: "common", w: 200, h: 144, props: { title: "Card", text: "Description" } },
  { type: "Modal", group: "common", w: 320, h: 200, props: { title: "Modal", text: "Content" } },
  { type: "Divider", group: "common", w: 200, h: 8, props: {} },
  { type: "Heading", group: "common", w: 240, h: 40, props: { text: "Heading", level: 1 } },
  { type: "Text", group: "common", w: 200, h: 40, props: { text: "Text" } },
  { type: "Button", group: "common", w: 120, h: 40, props: { text: "Button", variant: "default" } },
  { type: "Image", group: "common", w: 160, h: 120, props: { alt: "Image" } },
  { type: "DynamicPanel", group: "dynamic", w: 240, h: 160, props: { states: ["State 1", "State 2"], active: "State 1" } },
  { type: "Repeater", group: "dynamic", w: 280, h: 160, props: { layout: "table", columns: ["Col 1", "Col 2"], rows: 3 } },
  { type: "HotSpot", group: "dynamic", w: 120, h: 80, props: { note: "" } },
  { type: "InlineFrame", group: "dynamic", w: 280, h: 184, props: { url: "https://example.com" } },
  { type: "Snapshot", group: "dynamic", w: 200, h: 144, props: { target: "Page 1" } },
  { type: "TextField", group: "forms", w: 200, h: 40, props: { placeholder: "Placeholder", value: "" } },
  { type: "TextArea", group: "forms", w: 200, h: 80, props: { placeholder: "Placeholder", value: "" } },
  { type: "ChoicePicker", group: "forms", w: 200, h: 40, props: { options: ["Option 1", "Option 2"], value: "Option 1" } },
  { type: "Checkbox", group: "forms", w: 160, h: 32, props: { text: "Checkbox", checked: false } },
  { type: "Radio", group: "forms", w: 160, h: 32, props: { text: "Radio", checked: false } },
  { type: "Switch", group: "forms", w: 144, h: 32, props: { text: "Switch", checked: false } },
  { type: "Slider", group: "forms", w: 200, h: 32, props: { value: 50, min: 0, max: 100 } },
  { type: "ListBox", group: "forms", w: 160, h: 120, props: { items: ["Item 1", "Item 2", "Item 3"], selected: "Item 1" } },
  { type: "SearchField", group: "forms", w: 200, h: 40, props: { placeholder: "Search", value: "" } },
  { type: "DatePicker", group: "forms", w: 200, h: 40, props: { placeholder: "mm/dd/yyyy" } },
  { type: "FileUpload", group: "forms", w: 240, h: 96, props: { text: "Choose file" } },
  { type: "Nav", group: "menus", w: 240, h: 40, props: { items: ["Home", "About", "Contact"] } },
  { type: "Tabs", group: "menus", w: 240, h: 40, props: { items: ["Tab 1", "Tab 2"], active: "Tab 1" } },
  { type: "List", group: "menus", w: 200, h: 160, props: { items: ["Item 1", "Item 2", "Item 3"] } },
  { type: "Table", group: "menus", w: 320, h: 160, props: { columns: 3, rows: 3 } },
  { type: "Tree", group: "menus", w: 200, h: 160, props: { items: ["Parent", "  Child A", "  Child B"] } },
  { type: "Menu", group: "menus", w: 240, h: 40, props: { orientation: "horizontal", items: ["File", "Edit", "View"] } },
  { type: "Breadcrumbs", group: "menus", w: 280, h: 32, props: { items: ["Home", "Section", "Page"] } },
  { type: "Pagination", group: "menus", w: 240, h: 32, props: { pages: 5, current: 1 } },
  { type: "Header", group: "content", w: 1280, h: 56, props: { text: "Header" } },
  { type: "Avatar", group: "content", w: 40, h: 40, props: { initials: "AB" } },
  { type: "Icon", group: "content", w: 32, h: 32, props: { name: "Star" } },
  { type: "Badge", group: "content", w: 64, h: 24, props: { text: "Badge" } },
  { type: "Progress", group: "content", w: 200, h: 24, props: { value: 60 } },
  { type: "Alert", group: "content", w: 280, h: 80, props: { variant: "info", title: "Alert", text: "Message" } },
  { type: "Tooltip", group: "content", w: 120, h: 32, props: { text: "Tooltip", placement: "top" } },
  { type: "Arrow", group: "markup", w: 120, h: 24, props: { orientation: "horizontal", stroke: "#333333" } },
  { type: "Sticky", group: "markup", w: 144, h: 120, props: { color: "yellow", text: "Note" } },
  { type: "Marker", group: "markup", w: 32, h: 32, props: { shape: "circle", text: "1", color: "red" } },
  { type: "Shape", group: "flow", w: 120, h: 72, props: { shape: "rectangle", text: "Process", fill: "#ffffff", stroke: "#333333" } },
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
    hidden: z.boolean().optional(),
    locked: z.boolean().optional(),
  })
  .strict();

const canvasSchema = z
  .object({
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
    background: z.string().min(1).max(64),
  })
  .strict();

const pageSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(200),
    canvas: canvasSchema,
    elements: z.array(elementSchema).max(2000),
    notes: z.string().max(8000).optional(),
  })
  .strict();

const wireframeV2Schema = z
  .object({
    format: z.literal(WIREFRAME_FORMAT),
    version: z.literal(WIREFRAME_VERSION),
    name: z.string().min(1).max(200),
    pages: z.array(pageSchema).min(1).max(200),
    activePageId: z.string().min(1).max(128),
  })
  .strict()
  .refine((doc) => doc.pages.some((page) => page.id === doc.activePageId), { message: "activePageId must match a page" });

const wireframeV1Schema = z
  .object({
    format: z.literal(WIREFRAME_FORMAT),
    version: z.literal(WIREFRAME_VERSION_LEGACY),
    name: z.string().min(1).max(200),
    canvas: canvasSchema,
    elements: z.array(elementSchema).max(2000),
  })
  .strict();

let nextId = 0;
let nextPageId = 0;

export function newElementId(): string {
  return `el_${Date.now().toString(36)}_${(++nextId).toString(36)}`;
}

export function newPageId(): string {
  return `pg_${Date.now().toString(36)}_${(++nextPageId).toString(36)}`;
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

export function nextPageName(pages: readonly { name: string }[]): string {
  const used = new Set(pages.map((page) => page.name));
  let n = 1;
  while (used.has(`Page ${n}`)) n += 1;
  return `Page ${n}`;
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

export function newPage(name?: string, canvas: WireframeCanvas = { ...CANVAS_PRESETS.desktop, background: "#ffffff" }): WireframePage {
  return { id: newPageId(), name: name ?? "Page 1", canvas, elements: [] };
}

export function newWireframe(name = "Untitled"): Wireframe {
  const page = newPage("Page 1");
  return {
    format: WIREFRAME_FORMAT,
    version: WIREFRAME_VERSION,
    name,
    pages: [page],
    activePageId: page.id,
  };
}

export function getActivePage(doc: Wireframe): WireframePage {
  return doc.pages.find((page) => page.id === doc.activePageId) ?? doc.pages[0]!;
}

export function updateActivePage(doc: Wireframe, update: (page: WireframePage) => WireframePage): Wireframe {
  return {
    ...doc,
    pages: doc.pages.map((page) => (page.id === doc.activePageId ? update(page) : page)),
  };
}

export function setActivePageId(doc: Wireframe, pageId: string): Wireframe {
  if (!doc.pages.some((page) => page.id === pageId)) return doc;
  return { ...doc, activePageId: pageId };
}

export function migrateWireframeV1(v1: z.infer<typeof wireframeV1Schema>): Wireframe {
  const page = newPage("Page 1", v1.canvas);
  return {
    format: WIREFRAME_FORMAT,
    version: WIREFRAME_VERSION,
    name: v1.name,
    activePageId: page.id,
    pages: [{ ...page, elements: v1.elements }],
  };
}

export function parseWireframe(input: unknown): Wireframe {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  if (typeof raw === "object" && raw !== null && (raw as { version?: number }).version === WIREFRAME_VERSION_LEGACY) {
    return migrateWireframeV1(wireframeV1Schema.parse(raw));
  }
  return wireframeV2Schema.parse(raw);
}

export function cloneWireframe(doc: Wireframe): Wireframe {
  return structuredClone(doc);
}
