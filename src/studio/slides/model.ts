import { z } from "zod";
import { studioT } from "../../shared/i18n.ts";
import {
  SNAP,
  type WireframeCanvas,
  type WireframeComponent,
  type WireframeElement,
  newElementId,
  nextLabel,
  defaultElement,
} from "../prototype/model.ts";

export const SLIDES_FORMAT = "bb-slides" as const;
export const SLIDES_VERSION = 1;
export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;

export const LAYOUT_IDS = ["title", "title-body", "two-column", "image-caption", "blank"] as const;
export type SlideLayout = (typeof LAYOUT_IDS)[number];

export type DeckTheme = { mode: "light" | "dark"; accent: string };

export type Slide = {
  id: string;
  name: string;
  layout: SlideLayout;
  canvas: WireframeCanvas;
  elements: WireframeElement[];
  notes?: string;
};

export type SlidesDeck = {
  format: typeof SLIDES_FORMAT;
  version: typeof SLIDES_VERSION;
  name: string;
  theme: DeckTheme;
  slides: Slide[];
  activeSlideId: string;
  components?: WireframeComponent[];
};

const propValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.string()), z.array(z.array(z.string()))]);

const elementTypes = z.enum([
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
  "Connector",
  "Instance",
]);

const elementSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: elementTypes,
    label: z.string().min(1).max(200),
    x: z.number().finite(),
    y: z.number().finite(),
    w: z.number().positive().max(8192),
    h: z.number().positive().max(8192),
    props: z.record(z.string(), propValueSchema),
    note: z.string().max(4000).optional(),
    hidden: z.boolean().optional(),
    locked: z.boolean().optional(),
    groupId: z.string().min(1).max(128).optional(),
    style: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const canvasSchema = z
  .object({
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
    background: z.string().min(1).max(64),
  })
  .strict();

const slideSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(200),
    layout: z.enum(LAYOUT_IDS),
    canvas: canvasSchema,
    elements: z.array(elementSchema).max(2000),
    notes: z.string().max(8000).optional(),
  })
  .strict();

const componentSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(200),
    w: z.number().positive().max(8192),
    h: z.number().positive().max(8192),
    elements: z.array(elementSchema).max(500),
  })
  .strict();

const deckSchema = z
  .object({
    format: z.literal(SLIDES_FORMAT),
    version: z.literal(SLIDES_VERSION),
    name: z.string().min(1).max(200),
    theme: z.object({ mode: z.enum(["light", "dark"]), accent: z.string().min(1).max(32) }).strict(),
    slides: z.array(slideSchema).min(1).max(500),
    activeSlideId: z.string().min(1).max(128),
    components: z.array(componentSchema).max(200).optional(),
  })
  .strict()
  .refine((doc) => doc.slides.some((slide) => slide.id === doc.activeSlideId), { message: "activeSlideId must match a slide" });

let nextSlideId = 0;

export function newSlideId(): string {
  return `sl_${Date.now().toString(36)}_${(++nextSlideId).toString(36)}`;
}

export function themeCanvas(theme: DeckTheme): WireframeCanvas {
  return {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    background: theme.mode === "dark" ? "#18181b" : "#ffffff",
  };
}

export function defaultTheme(): DeckTheme {
  return { mode: "light", accent: "#2563eb" };
}

export function nextSlideName(slides: readonly { name: string }[]): string {
  const used = new Set(slides.map((slide) => slide.name));
  let n = 1;
  while (used.has(studioT("slidesSlideN", { n }))) n += 1;
  return studioT("slidesSlideN", { n });
}

export function newSlide(layout: SlideLayout, theme: DeckTheme, name?: string, elements: WireframeElement[] = []): Slide {
  return {
    id: newSlideId(),
    name: name ?? studioT("slidesSlideN", { n: 1 }),
    layout,
    canvas: themeCanvas(theme),
    elements,
  };
}

export function newDeck(name?: string): SlidesDeck {
  const theme = defaultTheme();
  const slide = newSlide("title", theme);
  slide.elements = [
    headingElement(studioT("slidesDefTitle"), 80, 252, 1120, 96, []),
    textElement(studioT("slidesDefSubtitle"), 80, 364, 1120, 48, slide.elements),
  ];
  return {
    format: SLIDES_FORMAT,
    version: SLIDES_VERSION,
    name: name ?? studioT("protoUntitled"),
    theme,
    slides: [slide],
    activeSlideId: slide.id,
  };
}

export function getActiveSlide(deck: SlidesDeck): Slide {
  return deck.slides.find((slide) => slide.id === deck.activeSlideId) ?? deck.slides[0]!;
}

export function setActiveSlideId(deck: SlidesDeck, slideId: string): SlidesDeck {
  if (!deck.slides.some((slide) => slide.id === slideId)) return deck;
  return { ...deck, activeSlideId: slideId };
}

export function updateActiveSlide(deck: SlidesDeck, update: (slide: Slide) => Slide): SlidesDeck {
  return {
    ...deck,
    slides: deck.slides.map((slide) => (slide.id === deck.activeSlideId ? update(slide) : slide)),
  };
}

export function updateSlideById(deck: SlidesDeck, slideId: string, update: (slide: Slide) => Slide): SlidesDeck {
  return {
    ...deck,
    slides: deck.slides.map((slide) => (slide.id === slideId ? update(slide) : slide)),
  };
}

export function reorderSlides(deck: SlidesDeck, fromIndex: number, toIndex: number): SlidesDeck {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= deck.slides.length || toIndex >= deck.slides.length) {
    return deck;
  }
  const slides = [...deck.slides];
  const [moved] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, moved!);
  return { ...deck, slides };
}

export function duplicateSlide(deck: SlidesDeck, slideId: string): SlidesDeck {
  const index = deck.slides.findIndex((slide) => slide.id === slideId);
  if (index < 0) return deck;
  const source = deck.slides[index]!;
  const copy: Slide = {
    ...structuredClone(source),
    id: newSlideId(),
    name: nextSlideName(deck.slides),
    elements: source.elements.map((el) => ({ ...structuredClone(el), id: newElementId() })),
  };
  const slides = [...deck.slides];
  slides.splice(index + 1, 0, copy);
  return { ...deck, slides, activeSlideId: copy.id };
}

export function removeSlide(deck: SlidesDeck, slideId: string): SlidesDeck {
  if (deck.slides.length <= 1) return deck;
  const slides = deck.slides.filter((slide) => slide.id !== slideId);
  const activeSlideId = deck.activeSlideId === slideId ? slides[0]!.id : deck.activeSlideId;
  return { ...deck, slides, activeSlideId };
}

export function addSlide(deck: SlidesDeck, layout: SlideLayout = "blank"): SlidesDeck {
  const slide = newSlide(layout, deck.theme, nextSlideName(deck.slides));
  return { ...deck, slides: [...deck.slides, slide], activeSlideId: slide.id };
}

export function applyThemeToDeck(deck: SlidesDeck, theme: DeckTheme): SlidesDeck {
  return {
    ...deck,
    theme,
    slides: deck.slides.map((slide) => ({ ...slide, canvas: { ...slide.canvas, background: themeCanvas(theme).background } })),
  };
}

export function headingElement(text: string, x: number, y: number, w: number, h: number, existing: WireframeElement[]): WireframeElement {
  const el = defaultElement("Heading", x, y, existing);
  return { ...el, w, h, props: { ...el.props, text, level: 1 } };
}

export function textElement(text: string, x: number, y: number, w: number, h: number, existing: WireframeElement[]): WireframeElement {
  const el = defaultElement("Text", x, y, existing);
  return { ...el, w, h, props: { ...el.props, text } };
}

export function imagePlaceholder(x: number, y: number, w: number, h: number, existing: WireframeElement[]): WireframeElement {
  const el = defaultElement("Image", x, y, existing);
  return { ...el, w, h, props: { ...el.props, src: "", alt: nextLabel("Image", existing) } };
}

export function snap(v: number, grid = SNAP): number {
  return Math.round(v / grid) * grid;
}

export function parseSlidesDeck(input: unknown): SlidesDeck {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  return deckSchema.parse(raw) as SlidesDeck;
}

export function cloneDeck(deck: SlidesDeck): SlidesDeck {
  return structuredClone(deck);
}
