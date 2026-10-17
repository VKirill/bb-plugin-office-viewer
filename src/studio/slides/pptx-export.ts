import type { WireframeElement } from "../prototype/model.ts";
import type { Slide, SlidesDeck } from "./model.ts";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "./model.ts";

export type PptxTextDescriptor = {
  kind: "text";
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
};

export type PptxShapeDescriptor = {
  kind: "shape";
  shape: "rect" | "ellipse" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  line?: string;
};

export type PptxImageDescriptor = {
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  data?: string;
  alt?: string;
};

export type PptxTableDescriptor = {
  kind: "table";
  x: number;
  y: number;
  w: number;
  h: number;
  rows: string[][];
};

export type PptxFallbackDescriptor = {
  kind: "fallback";
  reason: string;
  elementType: string;
};

export type PptxDescriptor = PptxTextDescriptor | PptxShapeDescriptor | PptxImageDescriptor | PptxTableDescriptor | PptxFallbackDescriptor;

const PX_PER_IN = 96;
const SLIDE_W_IN = SLIDE_WIDTH / PX_PER_IN;
const SLIDE_H_IN = SLIDE_HEIGHT / PX_PER_IN;

export function pxToInX(px: number): number {
  return (px / SLIDE_WIDTH) * SLIDE_W_IN;
}

export function pxToInY(px: number): number {
  return (px / SLIDE_HEIGHT) * SLIDE_H_IN;
}

export function pxToInW(px: number): number {
  return (px / SLIDE_WIDTH) * SLIDE_W_IN;
}

export function pxToInH(px: number): number {
  return (px / SLIDE_HEIGHT) * SLIDE_H_IN;
}

function readText(el: WireframeElement): string {
  const text = el.props.text;
  if (typeof text === "string" && text) return text;
  const placeholder = el.props.placeholder;
  if (typeof placeholder === "string" && placeholder) return placeholder;
  return el.label;
}

function styleColor(el: WireframeElement): string | undefined {
  const fill = el.style?.base?.fill;
  return typeof fill === "string" ? fill : undefined;
}

export function mapElementToPptx(el: WireframeElement): PptxDescriptor {
  const box = { x: pxToInX(el.x), y: pxToInY(el.y), w: pxToInW(el.w), h: pxToInH(el.h) };

  if (el.type === "Heading" || el.type === "Text" || el.type === "Paragraph" || el.type === "Label") {
    return {
      kind: "text",
      text: readText(el),
      ...box,
      fontSize: el.type === "Heading" ? 28 : 16,
      bold: el.type === "Heading",
      color: styleColor(el) ?? "#111111",
      align: (el.style?.base?.textAlign as "left" | "center" | "right" | undefined) ?? "left",
    };
  }

  if (el.type === "Button") {
    return {
      kind: "text",
      text: readText(el),
      ...box,
      fontSize: 14,
      bold: true,
      color: "#ffffff",
      align: "center",
    };
  }

  if (el.type === "Box" || el.type === "Card" || el.type === "Container") {
    return {
      kind: "shape",
      shape: "rect",
      ...box,
      fill: styleColor(el) ?? (typeof el.props.fill === "string" ? el.props.fill : "#e4e4e7"),
      line: "#a1a1aa",
    };
  }

  if (el.type === "Ellipse") {
    return {
      kind: "shape",
      shape: "ellipse",
      ...box,
      fill: styleColor(el) ?? "#dbeafe",
      line: "#3b82f6",
    };
  }

  if (el.type === "Line" || el.type === "Arrow") {
    return { kind: "shape", shape: "line", ...box, line: styleColor(el) ?? "#18181b" };
  }

  if (el.type === "Image" || el.type === "Avatar") {
    const src = el.props.src;
    return {
      kind: "image",
      ...box,
      data: typeof src === "string" && src.startsWith("data:") ? src : undefined,
      alt: typeof el.props.alt === "string" ? el.props.alt : el.label,
    };
  }

  if (el.type === "Table") {
    const rows = el.props.rows;
    const tableRows = Array.isArray(rows) && rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"))
      ? (rows as string[][])
      : [["", ""]];
    return { kind: "table", ...box, rows: tableRows };
  }

  if (el.type === "List") {
    const items = el.props.items;
    const lines = Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : [];
    return {
      kind: "text",
      text: lines.map((line) => `• ${line}`).join("\n"),
      ...box,
      fontSize: 16,
      align: "left",
    };
  }

  if (el.type === "Icon") {
    const name = el.props.name;
    return {
      kind: "text",
      text: typeof name === "string" ? name.replace(/Icon$/, "") : el.label,
      ...box,
      fontSize: 12,
      align: "center",
    };
  }

  return { kind: "fallback", reason: "unsupported-element", elementType: el.type };
}

export function mapSlideToPptxDescriptors(slide: Slide): PptxDescriptor[] {
  return slide.elements.filter((el) => !el.hidden).map(mapElementToPptx);
}

export function mapDeckToPptxDescriptors(deck: SlidesDeck): PptxDescriptor[][] {
  return deck.slides.map(mapSlideToPptxDescriptors);
}

export async function deckToPptxBlob(deck: SlidesDeck): Promise<Blob> {
  const pptxgen = (await import("pptxgenjs")).default;
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";

  for (const slide of deck.slides) {
    const page = pptx.addSlide();
    const bg = slide.canvas.background.replace("#", "");
    if (bg) page.background = { color: bg };

    for (const el of slide.elements) {
      if (el.hidden) continue;
      const mapped = mapElementToPptx(el);
      if (mapped.kind === "text") {
        page.addText(mapped.text, {
          x: mapped.x,
          y: mapped.y,
          w: mapped.w,
          h: mapped.h,
          fontSize: mapped.fontSize,
          bold: mapped.bold,
          color: mapped.color?.replace("#", ""),
          align: mapped.align,
        });
      } else if (mapped.kind === "shape") {
        if (mapped.shape === "line") {
          page.addShape(pptxgen.ShapeType.line, {
            x: mapped.x,
            y: mapped.y,
            w: mapped.w,
            h: mapped.h,
            line: { color: mapped.line?.replace("#", "") ?? "18181b" },
          });
        } else {
          page.addShape(mapped.shape === "ellipse" ? pptxgen.ShapeType.ellipse : pptxgen.ShapeType.rect, {
            x: mapped.x,
            y: mapped.y,
            w: mapped.w,
            h: mapped.h,
            fill: mapped.fill ? { color: mapped.fill.replace("#", "") } : undefined,
            line: mapped.line ? { color: mapped.line.replace("#", "") } : undefined,
          });
        }
      } else if (mapped.kind === "image" && mapped.data) {
        page.addImage({ data: mapped.data, x: mapped.x, y: mapped.y, w: mapped.w, h: mapped.h });
      } else if (mapped.kind === "table") {
        const rows = mapped.rows.map((row) => row.map((cell) => ({ text: cell })));
        page.addTable(rows, { x: mapped.x, y: mapped.y, w: mapped.w });
      }
    }
  }

  const out = await pptx.write({ outputType: "blob" });
  return out as Blob;
}
