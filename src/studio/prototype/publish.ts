// Publish preview bundle, raster/vector exports, and Excalidraw/SVG import.
import { z } from "zod";
import { commentNumbersOnPage, commentsForPage } from "./comments.ts";
import { resolvePageView, type PageDeviceView } from "./layout.ts";
import {
  CANVAS_PRESETS,
  defaultElement,
  newElementId,
  newPage,
  snap,
  type Wireframe,
  type WireframeElement,
  type WireframePage,
} from "./model.ts";
import { isFlowShape, shapePath } from "./shapes.ts";

export const PLUGIN_HTTP_PREFIX = "/api/v1/plugins/office-viewer/http";

export const PNG_EXPORT_DEVICES: readonly PageDeviceView[] = ["desktop", "tablet", "phone"];
export const PNG_EXPORT_SCALES = [1, 2, 3] as const;
export type PngExportScale = (typeof PNG_EXPORT_SCALES)[number];

export function prototypePreviewHttpPath(threadId: string, stem: string): string {
  const safeThread = encodeURIComponent(threadId);
  const safeStem = encodeURIComponent(stem);
  return `/prototype/preview/${safeThread}/${safeStem}/index.html`;
}

export function prototypePreviewUrl(threadId: string, stem: string, origin = ""): string {
  const path = prototypePreviewHttpPath(threadId, stem);
  return `${origin.replace(/\/$/, "")}${PLUGIN_HTTP_PREFIX}${path}`;
}

export function slugPageFilePart(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "page";
}

export function pngExportFileName(stem: string, page: WireframePage, device: PageDeviceView, scale: PngExportScale): string {
  return `${stem}-${slugPageFilePart(page.name)}-${device}@${scale}x.png`;
}

export function svgExportFileName(stem: string, page: WireframePage): string {
  return `${stem}-${slugPageFilePart(page.name)}.svg`;
}

export function pdfExportFileName(stem: string): string {
  return `${stem}-prototype.pdf`;
}

export type PdfNoteLine = { pageName: string; number: number; text: string; elementLabel?: string };

export function collectPdfNotes(doc: Wireframe, includeNotes: boolean): PdfNoteLine[] {
  if (!includeNotes) return [];
  const out: PdfNoteLine[] = [];
  for (const page of doc.pages) {
    const numbers = commentNumbersOnPage(doc, page.id);
    for (const comment of commentsForPage(doc, page.id)) {
      const element = comment.elementId ? page.elements.find((el) => el.id === comment.elementId) : undefined;
      out.push({
        pageName: page.name,
        number: numbers.get(comment.id) ?? 0,
        text: comment.text,
        elementLabel: element?.label,
      });
    }
    for (const el of page.elements) {
      if (!el.note?.trim()) continue;
      out.push({ pageName: page.name, number: 0, text: el.note.trim(), elementLabel: el.label });
    }
  }
  return out;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function propText(el: WireframeElement, key: string, fallback = ""): string {
  const value = el.props[key];
  return typeof value === "string" ? value : fallback;
}

function elementSvgFragment(el: WireframeElement): string {
  const { x, y, w, h } = el;
  const fill = el.style?.base?.fill ?? "#e5e7eb";
  const stroke = el.style?.base?.stroke ?? "#374151";
  const label = escapeXml(propText(el, "text", el.label));
  switch (el.type) {
    case "Text":
    case "Heading":
    case "Label":
    case "Paragraph":
      return `<text x="${x + 4}" y="${y + 20}" font-family="system-ui,sans-serif" font-size="${el.style?.base?.fontSize ?? 14}" fill="${stroke}">${label}</text>`;
    case "Button":
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}"/><text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="${stroke}">${label}</text>`;
    case "Ellipse":
      return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}"/>`;
    case "Line":
      return `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="${stroke}" stroke-width="2"/>`;
    case "Shape": {
      const shape = propText(el, "shape", "rectangle");
      if (!isFlowShape(shape)) {
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>`;
      }
      const d = shapePath(shape, w, h);
      return `<g transform="translate(${x} ${y})"><path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/></g>`;
    }
    case "Image":
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f3f4f6" stroke="${stroke}"/><text x="${x + 8}" y="${y + 20}" font-size="12" fill="#6b7280">image</text>`;
    default:
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1"/><text x="${x + 4}" y="${y + 14}" font-size="11" fill="#6b7280">${escapeXml(el.type)}</text>`;
  }
}

export function buildPageSvg(doc: Wireframe, pageId: string, deviceView: PageDeviceView = "desktop"): string {
  const raw = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0]!;
  const page = resolvePageView(raw, deviceView);
  const elements = page.elements.filter((el) => !el.hidden);
  const { width, height, background } = page.canvas;
  const body = elements.map((el) => elementSvgFragment(el)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${escapeXml(background ?? "#ffffff")}"/>\n${body}\n</svg>`;
}

type PdfPage = { widthPt: number; heightPt: number; jpeg: Uint8Array };

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Minimal PDF 1.4 with one full-page JPEG image per entry (72 dpi: 1 px = 1 pt). */
export function buildPdfFromJpegPages(pages: readonly PdfPage[], notes: readonly PdfNoteLine[] = []): Uint8Array {
  const parts: (string | Uint8Array)[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let nextId = 1;
  const catalogId = nextId++;
  const pagesId = nextId++;
  const pageObjectIds: number[] = [];

  const pushObj = (id: number, body: string | Uint8Array) => {
    offsets[id] = parts.reduce((sum, part) => sum + (typeof part === "string" ? part.length : part.byteLength), 0);
    parts.push(`${id} 0 obj\n`);
    parts.push(body);
    parts.push(typeof body === "string" && body.endsWith("\nendobj\n") ? "" : "\nendobj\n");
  };

  for (const page of pages) {
    const imgId = nextId++;
    const contentId = nextId++;
    const pageId = nextId++;
    pageObjectIds.push(pageId);
    const imgHeader = `<< /Type /XObject /Subtype /Image /Width ${Math.round(page.widthPt)} /Height ${Math.round(page.heightPt)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.byteLength} >>\nstream\n`;
    offsets[imgId] = parts.reduce((sum, part) => sum + (typeof part === "string" ? part.length : part.byteLength), 0);
    parts.push(`${imgId} 0 obj\n${imgHeader}`);
    parts.push(page.jpeg);
    parts.push("\nendstream\nendobj\n");
    const drawName = `Im${imgId}`;
    const content = `q ${page.widthPt} 0 0 ${page.heightPt} 0 0 cm /${drawName} Do Q`;
    pushObj(
      contentId,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    pushObj(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.widthPt} ${page.heightPt}] /Resources << /XObject << /${drawName} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
  }

  if (notes.length) {
    const lines = notes.map((note) => {
      const prefix = note.number > 0 ? `#${note.number} ` : "";
      const target = note.elementLabel ? ` (${note.elementLabel})` : "";
      return `${note.pageName}${target}: ${prefix}${note.text}`;
    });
    const text = pdfEscape(lines.join("\\n").slice(0, 4000));
    const fontId = nextId++;
    const contentId = nextId++;
    const pageId = nextId++;
    pageObjectIds.push(pageId);
    pushObj(fontId, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
    const stream = `BT /F1 11 Tf 50 750 Td (${text}) Tj ET`;
    pushObj(contentId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pushObj(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
  }

  pushObj(pagesId, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);
  pushObj(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const xrefStart = parts.reduce((sum, part) => sum + (typeof part === "string" ? part.length : part.byteLength), 0);
  const maxId = nextId - 1;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    const off = offsets[id] ?? 0;
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  parts.push(xref);
  parts.push(`trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const total = parts.reduce((sum, part) => sum + (typeof part === "string" ? part.length : part.byteLength), 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    if (typeof part === "string") {
      out.set(new TextEncoder().encode(part), cursor);
      cursor += part.length;
    } else {
      out.set(part, cursor);
      cursor += part.byteLength;
    }
  }
  return out;
}

export function buildStaticPlayerHtml(doc: Wireframe): string {
  const title = escapeXml(doc.name);
  const dataJson = JSON.stringify(doc).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column}
  header{display:flex;gap:8px;align-items:center;padding:8px 12px;background:#1e293b;border-bottom:1px solid #334155;flex-wrap:wrap}
  header select,header button{font:inherit;padding:6px 10px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:inherit}
  #stage{flex:1;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:24px}
  #board{position:relative;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,.35)}
  .el{position:absolute;overflow:hidden;font-size:14px}
  .btn{display:flex;align-items:center;justify-content:center;background:#2563eb;color:#fff;border-radius:6px;padding:4px}
  .box{border:1px solid #94a3b8;background:#f8fafc}
  .hotspot{outline:2px dashed rgba(37,99,235,.45);outline-offset:-2px;cursor:pointer}
</style>
</head>
<body>
<header>
  <strong>${title}</strong>
  <select id="pageSelect" aria-label="Page"></select>
  <button type="button" id="fitBtn">Fit</button>
</header>
<div id="stage"><div id="board"></div></div>
<script>
const DOC=${dataJson};
const board=document.getElementById("board");
const pageSelect=document.getElementById("pageSelect");
let state={pageId:DOC.pages[0]?.id,patches:{}};
function resolveEl(el){const p=state.patches[el.id];if(!p)return el;return {...el,hidden:p.hidden??el.hidden,props:p.props?{...el.props,...p.props}:el.props};}
function page(){return DOC.pages.find(p=>p.id===state.pageId)||DOC.pages[0];}
function render(){
  const p=page();if(!p)return;
  board.style.width=p.canvas.width+"px";board.style.height=p.canvas.height+"px";board.style.background=p.canvas.background||"#fff";
  board.innerHTML="";
  for(const el of p.elements.map(resolveEl).filter(e=>!e.hidden)){
    const n=document.createElement("div");
    n.className="el"+(el.type==="Button"?" btn":el.type==="HotSpot"?" hotspot":" box");
    n.style.left=el.x+"px";n.style.top=el.y+"px";n.style.width=el.w+"px";n.style.height=el.h+"px";
    const text=el.props?.text||el.props?.title||el.label||el.type;
    if(el.type!=="HotSpot")n.textContent=typeof text==="string"?text:el.type;
    if(el.interactions?.length)n.addEventListener("click",()=>run(el,"click"));
    board.appendChild(n);
  }
}
function patch(id,patch){const prev=state.patches[id]||{};state.patches[id]={...prev,...patch,props:patch.props?{...(prev.props||{}),...patch.props}:prev.props};}
function run(el,event){
  const block=(el.interactions||[]).find(i=>i.event===event);if(!block?.cases?.[0])return;
  for(const a of block.cases[0].actions||[]){
    if(a.type==="goToPage"&&a.pageId&&DOC.pages.some(p=>p.id===a.pageId)){state.pageId=a.pageId;state.patches={};pageSelect.value=a.pageId;render();}
    if(a.type==="openLink"&&a.url)window.open(a.url,a.target||"_blank");
    if(a.type==="show"&&a.targetId)patch(a.targetId,{hidden:false});
    if(a.type==="hide"&&a.targetId)patch(a.targetId,{hidden:true});
    if(a.type==="setText"&&a.targetId)patch(a.targetId,{props:{text:a.text||""}});
  }
  render();
}
DOC.pages.forEach(p=>{const o=document.createElement("option");o.value=p.id;o.textContent=p.name;pageSelect.appendChild(o);});
pageSelect.value=state.pageId;pageSelect.onchange=()=>{state.pageId=pageSelect.value;state.patches={};render();};
document.getElementById("fitBtn").onclick=()=>{const s=document.getElementById("stage");const p=page();const z=Math.min((s.clientWidth-48)/p.canvas.width,(s.clientHeight-48)/p.canvas.height,1);board.style.transform="scale("+z+")";board.style.transformOrigin="top center";};
render();
</script>
</body>
</html>`;
}

export type ImportPlacement = { elements: WireframeElement[]; canvas?: { width: number; height: number } };

const excalidrawElementSchema = z
  .object({
    type: z.string(),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().optional(),
    height: z.number().finite().optional(),
    text: z.string().optional(),
    label: z.union([z.string(), z.object({ text: z.string().optional() })]).optional(),
    strokeColor: z.string().optional(),
    backgroundColor: z.string().optional(),
  })
  .passthrough();

const excalidrawDocSchema = z
  .object({
    type: z.literal("excalidraw").optional(),
    elements: z.array(excalidrawElementSchema),
    appState: z.object({ width: z.number().finite().optional(), height: z.number().finite().optional() }).optional(),
  })
  .passthrough();

function excalidrawLabel(el: z.infer<typeof excalidrawElementSchema>): string {
  if (typeof el.label === "string") return el.label;
  if (el.label && typeof el.label === "object" && el.label.text) return el.label.text;
  return el.text ?? "";
}

export function importExcalidrawJson(raw: string): ImportPlacement {
  const parsed = excalidrawDocSchema.parse(JSON.parse(raw));
  const elements: WireframeElement[] = [];
  for (const item of parsed.elements) {
    if (item.type === "arrow" || item.type === "line") {
      const el = defaultElement("Line", snap(item.x), snap(item.y), elements);
      el.w = snap(Math.max(8, item.width ?? 80));
      el.h = snap(Math.max(8, item.height ?? 8));
      if (item.strokeColor) el.style = { base: { stroke: item.strokeColor } };
      elements.push(el);
      continue;
    }
    const w = snap(Math.max(8, item.width ?? 120));
    const h = snap(Math.max(8, item.height ?? 48));
    const x = snap(item.x);
    const y = snap(item.y);
    if (item.type === "text" || item.type === "freedraw") {
      const el = defaultElement("Text", x, y, elements);
      el.w = w;
      el.h = h;
      el.props.text = excalidrawLabel(item);
      elements.push(el);
      continue;
    }
    if (item.type === "ellipse" || item.type === "diamond") {
      const el = defaultElement("Ellipse", x, y, elements);
      el.w = w;
      el.h = h;
      if (item.backgroundColor) el.style = { base: { fill: item.backgroundColor, stroke: item.strokeColor ?? "#111" } };
      elements.push(el);
      continue;
    }
    const el = defaultElement(item.type === "rectangle" || item.type === "image" ? "Box" : "Shape", x, y, elements);
    el.w = w;
    el.h = h;
    if (item.type !== "rectangle" && item.type !== "image") el.props.shape = "rounded";
    const label = excalidrawLabel(item);
    if (label) el.props.text = label;
    if (item.backgroundColor || item.strokeColor) {
      el.style = { base: { fill: item.backgroundColor ?? "#f8fafc", stroke: item.strokeColor ?? "#334155" } };
    }
    elements.push(el);
  }
  const width = snap(parsed.appState?.width ?? CANVAS_PRESETS.desktop.width);
  const height = snap(parsed.appState?.height ?? CANVAS_PRESETS.desktop.height);
  return { elements, canvas: { width, height } };
}

function parseSvgLength(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) ? num : fallback;
}

export function importSvgMarkup(svg: string): ImportPlacement {
  const widthMatch = svg.match(/\bwidth=["']([^"']+)["']/i);
  const heightMatch = svg.match(/\bheight=["']([^"']+)["']/i);
  const viewBox = svg.match(/\bviewBox=["']([^"']+)["']/i)?.[1]?.trim().split(/\s+/).map(Number) ?? [];
  const canvasW = snap(viewBox[2] ?? parseSvgLength(widthMatch?.[1] ?? null, CANVAS_PRESETS.desktop.width));
  const canvasH = snap(viewBox[3] ?? parseSvgLength(heightMatch?.[1] ?? null, CANVAS_PRESETS.desktop.height));
  const elements: WireframeElement[] = [];
  const rectRe = /<rect\b[^>]*\/?>/gi;
  for (const match of svg.matchAll(rectRe)) {
    const tag = match[0];
    const x = parseSvgLength(/x=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 0);
    const y = parseSvgLength(/y=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 0);
    const w = parseSvgLength(/width=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 80);
    const h = parseSvgLength(/height=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 40);
    const fill = /fill=["']([^"']+)["']/i.exec(tag)?.[1];
    const el = defaultElement("Box", snap(x), snap(y), elements);
    el.w = snap(w);
    el.h = snap(h);
    if (fill && fill !== "none") el.style = { base: { fill } };
    elements.push(el);
  }
  const circleRe = /<circle\b[^>]*\/?>/gi;
  for (const match of svg.matchAll(circleRe)) {
    const tag = match[0];
    const cx = parseSvgLength(/cx=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 0);
    const cy = parseSvgLength(/cy=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 0);
    const r = parseSvgLength(/r=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 20);
    const el = defaultElement("Ellipse", snap(cx - r), snap(cy - r), elements);
    el.w = snap(r * 2);
    el.h = snap(r * 2);
    elements.push(el);
  }
  const textRe = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
  for (const match of svg.matchAll(textRe)) {
    const tag = match[0];
    const x = parseSvgLength(/x=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 0);
    const y = parseSvgLength(/y=["']([^"']+)["']/i.exec(tag)?.[1] ?? null, 0);
    const text = match[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    const el = defaultElement("Text", snap(x), snap(y), elements);
    el.w = snap(Math.max(80, text.length * 8));
    el.h = 32;
    el.props.text = text;
    elements.push(el);
  }
  return { elements, canvas: { width: canvasW, height: canvasH } };
}

export function mergeImportOntoPage(doc: Wireframe, placement: ImportPlacement, pageId?: string): Wireframe {
  const targetId = pageId ?? doc.activePageId;
  const pages = doc.pages.map((page) => {
    if (page.id !== targetId) return page;
    const canvas = placement.canvas ? { ...page.canvas, ...placement.canvas } : page.canvas;
    return { ...page, canvas, elements: [...page.elements, ...placement.elements] };
  });
  return { ...doc, pages };
}

export function importFileText(fileName: string, text: string): ImportPlacement {
  const lower = fileName.toLowerCase();
  const trimmed = text.trimStart();
  if (lower.endsWith(".excalidraw") || (lower.endsWith(".json") && trimmed.startsWith("{"))) {
    return importExcalidrawJson(text);
  }
  if (lower.endsWith(".svg") || trimmed.startsWith("<svg")) return importSvgMarkup(text);
  throw new Error("Unsupported import format");
}

export async function pngBlobToJpegBytes(png: Blob, quality = 0.88): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(png);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);
  const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Uint8Array(await jpeg.arrayBuffer());
}

export function triggerDownload(bytes: Uint8Array | Blob, fileName: string, mime: string): void {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function newPageFromImport(doc: Wireframe, placement: ImportPlacement, pageName: string): Wireframe {
  const canvas = {
    ...CANVAS_PRESETS.desktop,
    background: "#ffffff",
    ...(placement.canvas ?? {}),
  };
  const page = newPage(pageName, canvas);
  page.elements = placement.elements.map((el) => ({ ...el, id: newElementId() }));
  return { ...doc, pages: [...doc.pages, page], activePageId: page.id };
}
