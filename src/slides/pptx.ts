// Office Viewer — PowerPoint reader. A .pptx is a zip of XML parts; this turns
// it into plain data the viewer can draw: slides made of positioned shapes,
// pictures, tables and text, with theme colors, layouts and masters applied.
// Charts, SmartArt and effects (shadows, 3-D, animations) are not drawn.
import { strFromU8, unzipSync } from "fflate";
import type { CSSProperties } from "react";
import { at, kid, kids, parseXml, type Xml } from "./xml.ts";
import { colorIn, css, DEFAULT_MAP, fillIn, hex, lineIn, parseTheme, type Colors, type Fill, type Line, type Rgba } from "./pptx-style.ts";
import type { Geometry } from "./pptx-geometry.ts";
import { buildBody, type Body, type BodyOptions, type TextBase } from "./pptx-text.ts";

const EMU = 9525;

export type Box = { x: number; y: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean };
export type Cell = { body: Body; css: CSSProperties; colSpan: number; rowSpan: number; skip: boolean };
export type Shape = Box &
  (
    | { kind: "shape"; geometry?: Geometry; fill?: Fill; line: Line | null; body?: Body }
    | { kind: "pic"; url: string; crop: [number, number, number, number]; round?: "ellipse" | number; line: Line | null; opacity: number }
    | { kind: "table"; cols: number[]; rows: { h: number; cells: Cell[] }[] }
    | { kind: "group"; children: Shape[] }
    | { kind: "unsupported"; label: "chart" | "diagram" | "object" }
  );
/** One paragraph of slide text, or (with `rows`) a table. */
export type Outline = { text: string; level: number; bullet: boolean; rows?: string[][] };
export type Slide = { index: number; hidden: boolean; background: Fill | undefined; shapes: Shape[]; notes: string; title: string; outline: Outline[] };
export type Deck = { width: number; height: number; slides: Slide[]; dispose(): void };

type Rels = Record<string, { target: string; type: string }>;
type Sink = { title: string[]; outline: Outline[] };
type Scope = {
  pkg: Pkg;
  colors: Colors;
  rels: Rels;
  /** The layout's and master's shape trees, to look placeholders up in. */
  layout?: Xml;
  master?: Xml;
  styles: { title?: Xml; body?: Xml; other?: Xml; defaults?: Xml };
  number: number;
  /** Collects the text of the slide's own shapes (not its layout's or master's). */
  sink?: Sink;
  skipPlaceholders: boolean;
};

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif" };
const SKIPPED = /^(ppt\/embeddings\/|docProps\/thumbnail|ppt\/media\/[^/]+\.(mp4|m4v|mov|wmv|avi|mpg|mpeg|webm|mp3|wav|m4a|wma|ogg)$)/i;

/** The zip with parsed-once XML parts, relationship tables and picture URLs. */
class Pkg {
  readonly urls = new Map<string, string | undefined>();
  private readonly xmls = new Map<string, Xml | undefined>();
  private readonly files: Record<string, Uint8Array>;

  constructor(files: Record<string, Uint8Array>) {
    this.files = files;
  }

  xml(path: string | undefined): Xml | undefined {
    if (!path) return undefined;
    if (!this.xmls.has(path)) this.xmls.set(path, this.files[path] ? parseXml(strFromU8(this.files[path])) : undefined);
    return this.xmls.get(path);
  }

  rels(part: string): Rels {
    const slash = part.lastIndexOf("/");
    const out: Rels = {};
    for (const rel of kids(this.xml(`${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`), "Relationship")) {
      if (rel.attrs.TargetMode === "External") continue;
      out[rel.attrs.Id] = { target: resolve(part, rel.attrs.Target), type: rel.attrs.Type };
    }
    return out;
  }

  /** A blob URL for a picture part, or undefined for formats browsers can't show (EMF, WMF, TIFF). */
  image(path: string | undefined): string | undefined {
    if (!path) return undefined;
    if (!this.urls.has(path)) {
      const mime = MIME[path.slice(path.lastIndexOf(".") + 1).toLowerCase()];
      const bytes = this.files[path];
      this.urls.set(path, mime && bytes ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime })) : undefined);
    }
    return this.urls.get(path);
  }
}

function resolve(from: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }
  return parts.join("/");
}

const relOf = (rels: Rels, type: string) => Object.values(rels).find((rel) => rel.type.endsWith(`/${type}`))?.target;
const holder = (...children: (Xml | undefined)[]): Xml => ({ name: "", attrs: {}, text: "", kids: children.filter((child): child is Xml => !!child) });

function boxOf(xfrm: Xml | undefined): Box | undefined {
  if (!xfrm) return undefined;
  const off = kid(xfrm, "a:off");
  const ext = kid(xfrm, "a:ext");
  return {
    x: Number(off?.attrs.x ?? 0) / EMU,
    y: Number(off?.attrs.y ?? 0) / EMU,
    w: Number(ext?.attrs.cx ?? 0) / EMU,
    h: Number(ext?.attrs.cy ?? 0) / EMU,
    rot: Number(xfrm.attrs.rot ?? 0) / 60000,
    flipH: xfrm.attrs.flipH === "1" || xfrm.attrs.flipH === "true",
    flipV: xfrm.attrs.flipV === "1" || xfrm.attrs.flipV === "true",
  };
}

const phOf = (node: Xml) => node.kids.map((child) => at(child, "p:nvPr", "p:ph")).find(Boolean);
/** Title, date/footer/number and everything else (body, object, picture…) pair up across slide, layout and master. */
const phClass = (type: string | undefined) => (type === "title" || type === "ctrTitle" ? "title" : type === "dt" || type === "ftr" || type === "sldNum" ? type : "body");

function findPlaceholder(tree: Xml | undefined, ph: Xml, byIndex: boolean): Xml | undefined {
  const candidates = tree?.kids.filter((node) => node.name === "p:sp" && phOf(node)) ?? [];
  if (byIndex && ph.attrs.idx) {
    const exact = candidates.find((node) => phOf(node)!.attrs.idx === ph.attrs.idx);
    if (exact) return exact;
  }
  return candidates.find((node) => phClass(phOf(node)!.attrs.type) === phClass(ph.attrs.type));
}

/** The layout's and master's counterparts of a slide placeholder, nearest first. */
function inherited(scope: Scope, ph: Xml): Xml[] {
  const layoutShape = findPlaceholder(scope.layout, ph, true);
  const masterShape = findPlaceholder(scope.master, layoutShape ? phOf(layoutShape)! : ph, false);
  return [layoutShape, masterShape].filter((node): node is Xml => !!node);
}

/** Replaces `<mc:AlternateContent>` with the fallback branch (plain shapes) or else the first choice. */
function flatten(nodes: Xml[]): Xml[] {
  return nodes.flatMap((node) => {
    if (node.name !== "mc:AlternateContent") return [node];
    const branch = kid(node, "mc:Fallback") ?? kid(node, "mc:Choice");
    return branch ? flatten(branch.kids) : [];
  });
}

const find = (node: Xml, name: string): Xml | undefined => (node.name === name ? node : node.kids.reduce<Xml | undefined>((hit, child) => hit ?? find(child, name), undefined));

const sourcesFor = (scope: Scope, chain: Xml[], ph: Xml | undefined): (Xml | undefined)[] => [
  scope.styles.defaults,
  ph ? (phClass(ph.attrs.type) === "title" ? scope.styles.title : phClass(ph.attrs.type) === "body" ? scope.styles.body : scope.styles.other) : undefined,
  ...[...chain].reverse().map((node) => at(node, "p:txBody", "a:lstStyle")),
];

function bodyOptions(scope: Scope, chain: Xml[], ph: Xml | undefined, base?: TextBase): BodyOptions {
  const bodyPrs = chain.map((node) => at(node, "p:txBody", "a:bodyPr"));
  return {
    sources: sourcesFor(scope, chain, ph),
    attrs: Object.assign({}, ...[...bodyPrs].reverse().map((node) => node?.attrs ?? {})),
    fit: bodyPrs.flatMap((node) => node?.kids ?? []).find((node) => /^a:(norm|sp|no)Autofit$/.test(node.name)),
    base,
    number: scope.number,
  };
}

function collect(scope: Scope, ph: Xml | undefined, body: Body | undefined) {
  if (!scope.sink || !body || ph?.attrs.type === "dt" || ph?.attrs.type === "ftr" || ph?.attrs.type === "sldNum") return;
  const title = phClass(ph?.attrs.type) === "title" && !!ph;
  for (const para of body.paras) {
    if (!para.text) continue;
    if (title) scope.sink.title.push(para.text);
    else scope.sink.outline.push({ text: para.text, level: para.level, bullet: !!para.bullet });
  }
}

function geometryOf(spPr: Xml | undefined): Geometry | undefined {
  const preset = kid(spPr, "a:prstGeom");
  if (preset) {
    const adj: Record<string, number> = {};
    for (const guide of kids(kid(preset, "a:avLst"), "a:gd")) {
      const value = /^val\s+(-?\d+)/.exec(guide.attrs.fmla ?? "");
      if (value) adj[guide.attrs.name] = Number(value[1]);
    }
    return { prst: preset.attrs.prst, adj };
  }
  const custom = kid(spPr, "a:custGeom");
  return custom ? { cust: custom } : undefined;
}

function parseShape(node: Xml, scope: Scope): Shape | undefined {
  const ph = phOf(node);
  if (ph && scope.skipPlaceholders) return undefined;
  const chain = [node, ...(ph ? inherited(scope, ph) : [])];
  const spPrs = chain.map((item) => kid(item, "p:spPr"));
  const box = spPrs.map((spPr) => boxOf(kid(spPr, "a:xfrm"))).find(Boolean);
  if (!box) return undefined;
  const style = chain.map((item) => kid(item, "p:style")).find(Boolean);
  const fillRef = kid(style, "a:fillRef");
  const lineRef = kid(style, "a:lnRef");
  const refColor = (ref: Xml | undefined): Rgba | undefined => colorIn(ref, scope.colors);
  const image = (id: string) => scope.pkg.image(scope.rels[id]?.target);
  const themeFill = Number(fillRef?.attrs.idx) > 0 ? scope.colors.theme.fills[Number(fillRef!.attrs.idx) - 1] : undefined;
  const fill = spPrs.map((spPr) => fillIn(spPr, scope.colors, image)).find(Boolean) ?? fillIn(holder(themeFill), scope.colors, image, refColor(fillRef));
  const themeLine = Number(lineRef?.attrs.idx) > 0 ? scope.colors.theme.lines[Number(lineRef!.attrs.idx) - 1] : undefined;
  const line = lineIn([themeLine, ...[...spPrs].reverse().map((spPr) => kid(spPr, "a:ln"))], scope.colors, refColor(lineRef));
  const fontRefColor = colorIn(kid(style, "a:fontRef"), scope.colors);
  const body = node.name === "p:sp" ? buildBody(kid(node, "p:txBody"), bodyOptions(scope, chain, ph, fontRefColor ? { color: fontRefColor } : undefined), scope.colors) : undefined;
  collect(scope, ph, body);
  const geometry = spPrs.map(geometryOf).find(Boolean) ?? (node.name === "p:cxnSp" ? { prst: "line", adj: {} } : undefined);
  return { kind: "shape", ...box, geometry, fill, line, body };
}

function parsePicture(node: Xml, scope: Scope, frame?: Box): Shape | undefined {
  const ph = phOf(node);
  const chain = [node, ...(ph ? inherited(scope, ph) : [])];
  const spPrs = chain.map((item) => kid(item, "p:spPr"));
  const box = frame ?? spPrs.map((spPr) => boxOf(kid(spPr, "a:xfrm"))).find(Boolean);
  if (!box) return undefined;
  const blip = at(node, "p:blipFill", "a:blip");
  const url = scope.pkg.image(scope.rels[blip?.attrs["r:embed"] ?? ""]?.target);
  if (!url) return { kind: "unsupported", label: "object", ...box };
  const source = kid(at(node, "p:blipFill"), "a:srcRect")?.attrs ?? {};
  const crop = (["l", "t", "r", "b"] as const).map((side) => Number(source[side] ?? 0) / 100000) as [number, number, number, number];
  const geometry = geometryOf(spPrs[0]);
  const round = geometry && "prst" in geometry ? (geometry.prst === "ellipse" ? "ellipse" : geometry.prst === "roundRect" ? ((geometry.adj.adj ?? 16667) / 100000) * Math.min(box.w, box.h) : undefined) : undefined;
  return {
    kind: "pic",
    ...box,
    url,
    crop,
    round,
    line: lineIn([kid(spPrs[0], "a:ln")], scope.colors),
    opacity: Number(kid(blip, "a:alphaModFix")?.attrs.amt ?? 100000) / 100000,
  };
}

function parseGroup(node: Xml, scope: Scope): Shape | undefined {
  const xfrm = at(node, "p:grpSpPr", "a:xfrm");
  const box = boxOf(xfrm);
  if (!box) return undefined;
  const childOffset = kid(xfrm, "a:chOff");
  const childExtent = kid(xfrm, "a:chExt");
  const originX = Number(childOffset?.attrs.x ?? 0) / EMU;
  const originY = Number(childOffset?.attrs.y ?? 0) / EMU;
  const width = Number(childExtent?.attrs.cx ?? 0) / EMU;
  const height = Number(childExtent?.attrs.cy ?? 0) / EMU;
  const sx = width > 0 ? box.w / width : 1;
  const sy = height > 0 ? box.h / height : 1;
  const children = parseTree(node, scope).map((child) => ({ ...child, x: (child.x - originX) * sx, y: (child.y - originY) * sy, w: child.w * sx, h: child.h * sy }));
  return { kind: "group", ...box, children };
}

// --- tables ---

type TablePart = { fill?: string; color?: Rgba; bold?: boolean; borders: Partial<Record<"left" | "right" | "top" | "bottom" | "insideH" | "insideV", Line | null>> };
type TableStyle = Partial<Record<string, TablePart>>;

const MEDIUM_2: Record<string, string> = { "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}": "accent1", "{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}": "accent2", "{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}": "accent3", "{00A15C55-8517-42AA-B614-E9B94910E393}": "accent4", "{7DF18680-E054-41AD-8BC1-D1AEF772440D}": "accent5", "{93296810-A885-4BE3-A3E7-6D5BEEA58F35}": "accent6" };

/** A table style: from the file's `tableStyles.xml`, or one of PowerPoint's built-in "Medium Style 2" styles, which files don't spell out. */
function tableStyle(id: string | undefined, scope: Scope): TableStyle {
  const { colors } = scope;
  const image = () => undefined;
  const defined = kids(scope.pkg.xml("ppt/tableStyles.xml"), "a:tblStyle").find((style) => style.attrs.styleId === id);
  if (defined) {
    const out: TableStyle = {};
    for (const part of defined.kids) {
      const text = kid(part, "a:tcTxStyle");
      const textColor = colorIn(kid(text, "a:fontRef"), colors) ?? colorIn(text, colors);
      const fill = fillIn(kid(kid(part, "a:tcStyle"), "a:fill"), colors, image);
      const borders: TablePart["borders"] = {};
      for (const side of ["left", "right", "top", "bottom", "insideH", "insideV"] as const) {
        const ln = kid(kid(kid(part, "a:tcStyle"), "a:tcBdr"), `a:${side}`);
        if (ln) borders[side] = lineIn([kid(ln, "a:ln")], colors, textColor);
      }
      out[part.name.slice(2)] = { fill: fill?.kind === "solid" ? fill.color : undefined, color: textColor, bold: text?.attrs.b === "on" ? true : undefined, borders };
    }
    return out;
  }
  const accent = hex(colors.theme.colors[MEDIUM_2[id ?? ""]]);
  if (!accent) return {};
  const mix = (amount: number): Rgba => [0, 1, 2].map((i) => accent[i] * amount + 255 * (1 - amount)).concat(1) as Rgba;
  const white: Line = { width: 1, color: "#ffffff", dash: [], head: false, tail: false };
  const header: TablePart = { fill: css(accent), color: [255, 255, 255, 1], bold: true, borders: { bottom: { ...white, width: 3 } } };
  return {
    wholeTbl: { fill: css(mix(0.2)), color: hex(colors.theme.colors.dk1), borders: { left: white, right: white, top: white, bottom: white, insideH: white, insideV: white } },
    band1H: { fill: css(mix(0.4)), borders: {} },
    band1V: { fill: css(mix(0.4)), borders: {} },
    firstRow: header,
    lastRow: { ...header, borders: { top: { ...white, width: 3 } } },
    firstCol: { ...header, borders: {} },
    lastCol: { ...header, borders: {} },
  };
}

const borderCss = (line: Line | null | undefined) => (line ? `${Math.max(0.5, line.width)}px ${line.dash.length ? "dashed" : "solid"} ${line.color}` : "none");

function parseTable(frame: Xml, box: Box, scope: Scope): Shape | undefined {
  const table = find(frame, "a:tbl");
  if (!table) return undefined;
  const flags = kid(table, "a:tblPr")?.attrs ?? {};
  const on = (name: string) => flags[name] === "1" || flags[name] === "true";
  const style = tableStyle(kid(kid(table, "a:tblPr"), "a:tableStyleId")?.text.trim(), scope);
  const rowNodes = kids(table, "a:tr");
  const cols = kids(kid(table, "a:tblGrid"), "a:gridCol").map((col) => Number(col.attrs.w) / EMU);
  const image = (id: string) => scope.pkg.image(scope.rels[id]?.target);
  const tableText: string[][] = [];
  const rows = rowNodes.map((tr, r) => {
    const cells = kids(tr, "a:tc").map((tc, c): Cell => {
      const pr = kid(tc, "a:tcPr");
      const bodyRow = r - (on("firstRow") ? 1 : 0);
      const layers = [
        "wholeTbl",
        ...(on("bandRow") && bodyRow >= 0 && !(on("lastRow") && r === rowNodes.length - 1) ? [bodyRow % 2 === 0 ? "band1H" : "band2H"] : []),
        ...(on("bandCol") && c - (on("firstCol") ? 1 : 0) >= 0 ? [(c - (on("firstCol") ? 1 : 0)) % 2 === 0 ? "band1V" : "band2V"] : []),
        ...(on("firstCol") && c === 0 ? ["firstCol"] : []),
        ...(on("lastCol") && c === cols.length - 1 ? ["lastCol"] : []),
        ...(on("firstRow") && r === 0 ? ["firstRow"] : []),
        ...(on("lastRow") && r === rowNodes.length - 1 ? ["lastRow"] : []),
      ].map((name) => style[name]).filter((part): part is TablePart => !!part);
      let background: string | undefined;
      const base: TextBase = {};
      const edges: Partial<Record<"left" | "right" | "top" | "bottom", Line | null>> = {};
      for (const part of layers) {
        if (part.fill) background = part.fill;
        if (part.color) base.color = part.color;
        if (part.bold) base.b = true;
        const last = r === rowNodes.length - 1;
        const end = c === cols.length - 1;
        const pick = (outer: Line | null | undefined, inner: Line | null | undefined, outside: boolean) => (outside ? outer : inner);
        for (const [side, value] of [["left", pick(part.borders.left, part.borders.insideV, c === 0)], ["right", pick(part.borders.right, part.borders.insideV, end)], ["top", pick(part.borders.top, part.borders.insideH, r === 0)], ["bottom", pick(part.borders.bottom, part.borders.insideH, last)]] as const) {
          if (value !== undefined) edges[side] = value;
        }
      }
      const own = fillIn(pr, scope.colors, image);
      if (own) background = own.kind === "solid" ? own.color : undefined;
      for (const [side, name] of [["left", "a:lnL"], ["right", "a:lnR"], ["top", "a:lnT"], ["bottom", "a:lnB"]] as const) {
        const ln = kid(pr, name);
        if (ln) edges[side] = lineIn([ln], scope.colors);
      }
      const attrs = { lIns: pr?.attrs.marL ?? "91440", tIns: pr?.attrs.marT ?? "45720", rIns: pr?.attrs.marR ?? "91440", bIns: pr?.attrs.marB ?? "45720", anchor: pr?.attrs.anchor ?? "t" };
      const body = buildBody(kid(tc, "a:txBody"), { sources: [scope.styles.defaults], attrs, base, number: scope.number }, scope.colors)!;
      return {
        body,
        colSpan: Number(tc.attrs.gridSpan ?? 1),
        rowSpan: Number(tc.attrs.rowSpan ?? 1),
        skip: tc.attrs.hMerge === "1" || tc.attrs.vMerge === "1",
        css: { background, borderLeft: borderCss(edges.left), borderRight: borderCss(edges.right), borderTop: borderCss(edges.top), borderBottom: borderCss(edges.bottom) },
      };
    });
    tableText.push(cells.filter((cell) => !cell.skip).map((cell) => cell.body.paras.map((para) => para.text).filter(Boolean).join(" ")));
    return { h: Number(tr.attrs.h ?? 0) / EMU, cells };
  });
  if (scope.sink && tableText.some((row) => row.some(Boolean))) scope.sink.outline.push({ text: "", level: 0, bullet: false, rows: tableText });
  return { kind: "table", ...box, cols, rows };
}

function parseFrame(node: Xml, scope: Scope): Shape | undefined {
  const box = boxOf(kid(node, "p:xfrm"));
  if (!box) return undefined;
  const data = at(node, "a:graphic", "a:graphicData");
  if (!data) return undefined;
  if (find(data, "a:tbl")) return parseTable(data, box, scope);
  if (data.attrs.uri?.includes("chart") || find(data, "c:chart")) return { kind: "unsupported", label: "chart", ...box };
  if (data.attrs.uri?.includes("diagram") || find(data, "dgm:relIds")) return { kind: "unsupported", label: "diagram", ...box };
  const picture = find(data, "p:pic");
  return (picture && parsePicture(picture, scope, box)) || { kind: "unsupported", label: "object", ...box };
}

function parseTree(tree: Xml | undefined, scope: Scope): Shape[] {
  const out: Shape[] = [];
  for (const node of flatten(tree?.kids ?? [])) {
    const hidden = node.kids.map((child) => kid(child, "p:cNvPr")).find(Boolean)?.attrs.hidden;
    if (hidden === "1" || hidden === "true") continue;
    const shape =
      node.name === "p:sp" || node.name === "p:cxnSp" ? parseShape(node, scope) : node.name === "p:pic" ? parsePicture(node, scope) : node.name === "p:graphicFrame" ? parseFrame(node, scope) : node.name === "p:grpSp" ? parseGroup(node, scope) : undefined;
    if (shape) out.push(shape);
  }
  return out;
}

// --- slides ---

type Frame = { colors: Colors; layout: Xml | undefined; master: Xml | undefined; styles: Scope["styles"]; background: Fill | undefined; behind: Shape[] };

function backgroundOf(root: Xml | undefined, scope: Scope): Fill | undefined {
  const bg = at(root, "p:cSld", "p:bg");
  const image = (id: string) => scope.pkg.image(scope.rels[id]?.target);
  const properties = kid(bg, "p:bgPr");
  if (properties) return fillIn(properties, scope.colors, image);
  const ref = kid(bg, "p:bgRef");
  if (!ref) return undefined;
  const index = Number(ref.attrs.idx);
  const themed = index >= 1001 ? scope.colors.theme.backgrounds[index - 1001] : undefined;
  return fillIn(holder(themed), scope.colors, image, colorIn(ref, scope.colors));
}

function plain(tx: Xml | undefined) {
  return kids(tx, "a:p")
    .map((p) => p.kids.map((child) => (child.name === "a:br" ? "\n" : child.name === "a:r" || child.name === "a:fld" ? (kid(child, "a:t")?.text ?? "") : "")).join(""))
    .join("\n")
    .trim();
}

export function parsePptx(bytes: Uint8Array): Deck {
  const pkg = new Pkg(unzipSync(bytes, { filter: (file) => !SKIPPED.test(file.name) }));
  const presentation = pkg.xml("ppt/presentation.xml");
  if (!presentation) throw new Error("Not a PowerPoint presentation");
  const size = at(presentation, "p:sldSz");
  const presentationRels = pkg.rels("ppt/presentation.xml");
  const defaults = kid(presentation, "p:defaultTextStyle");
  const frames = new Map<string, Frame>();

  const frameFor = (layoutPath: string | undefined): Frame => {
    const key = layoutPath ?? "";
    const cached = frames.get(key);
    if (cached) return cached;
    const layoutRoot = pkg.xml(layoutPath);
    const layoutRels = layoutPath ? pkg.rels(layoutPath) : {};
    const masterPath = relOf(layoutRels, "slideMaster");
    const masterRoot = pkg.xml(masterPath);
    const masterRels = masterPath ? pkg.rels(masterPath) : {};
    const theme = parseTheme(pkg.xml(relOf(masterRels, "theme")));
    const map = { ...DEFAULT_MAP, ...kid(masterRoot, "p:clrMap")?.attrs, ...kid(kid(layoutRoot, "p:clrMapOvr"), "a:overrideClrMapping")?.attrs };
    const colors: Colors = { theme, map };
    const txStyles = kid(masterRoot, "p:txStyles");
    const styles = { title: kid(txStyles, "p:titleStyle"), body: kid(txStyles, "p:bodyStyle"), other: kid(txStyles, "p:otherStyle"), defaults };
    const masterTree = at(masterRoot, "p:cSld", "p:spTree");
    const layoutTree = at(layoutRoot, "p:cSld", "p:spTree");
    const base = { pkg, colors, styles, number: 0, skipPlaceholders: true };
    const masterScope: Scope = { ...base, rels: masterRels, master: masterTree };
    const layoutScope: Scope = { ...base, rels: layoutRels, layout: layoutTree, master: masterTree };
    const showsMaster = layoutRoot?.attrs.showMasterSp !== "0";
    const frame: Frame = {
      colors,
      layout: layoutTree,
      master: masterTree,
      styles,
      background: backgroundOf(layoutRoot, layoutScope) ?? backgroundOf(masterRoot, masterScope),
      behind: [...(showsMaster ? parseTree(masterTree, masterScope) : []), ...parseTree(layoutTree, layoutScope)],
    };
    frames.set(key, frame);
    return frame;
  };

  const slides = kids(kid(presentation, "p:sldIdLst"), "p:sldId").flatMap((entry, position): Slide[] => {
    const path = presentationRels[entry.attrs["r:id"]]?.target;
    const root = pkg.xml(path);
    if (!path || !root) return [];
    const rels = pkg.rels(path);
    const frame = frameFor(relOf(rels, "slideLayout"));
    const override = kid(kid(root, "p:clrMapOvr"), "a:overrideClrMapping")?.attrs;
    const colors = override ? { ...frame.colors, map: { ...DEFAULT_MAP, ...override } } : frame.colors;
    const sink: Sink = { title: [], outline: [] };
    const scope: Scope = { pkg, colors, rels, layout: frame.layout, master: frame.master, styles: frame.styles, number: position + 1, sink, skipPlaceholders: false };
    const own = parseTree(at(root, "p:cSld", "p:spTree"), scope);
    const notesRoot = pkg.xml(relOf(rels, "notesSlide"));
    const notes = kids(at(notesRoot, "p:cSld", "p:spTree"), "p:sp")
      .filter((shape) => phOf(shape)?.attrs.type === "body")
      .map((shape) => plain(kid(shape, "p:txBody")))
      .filter(Boolean)
      .join("\n");
    return [
      {
        index: position,
        hidden: root.attrs.show === "0",
        background: backgroundOf(root, scope) ?? frame.background,
        shapes: root.attrs.showMasterSp === "0" ? own : [...frame.behind, ...own],
        notes,
        title: sink.title.join(" "),
        outline: sink.outline,
      },
    ];
  });

  return {
    width: Number(size?.attrs.cx ?? 9144000) / EMU,
    height: Number(size?.attrs.cy ?? 6858000) / EMU,
    slides,
    dispose: () => pkg.urls.forEach((url) => url && URL.revokeObjectURL(url)),
  };
}

/** The slide's text as Markdown: its title in bold, then the body text with bullets nested by level and tables as Markdown tables. */
export function slideMarkdown(slide: Slide): string {
  const lines: string[] = [];
  if (slide.title) lines.push(`**${slide.title}**`);
  let previousBullet = false;
  for (const item of slide.outline) {
    if (lines.length && !(item.bullet && previousBullet)) lines.push("");
    if (item.rows) {
      const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
      const width = Math.max(...item.rows.map((row) => row.length));
      item.rows.forEach((row, index) => {
        lines.push(`| ${Array.from({ length: width }, (_, i) => cell(row[i] ?? "")).join(" | ")} |`);
        if (index === 0) lines.push(`|${"---|".repeat(width)}`);
      });
    } else lines.push(item.bullet ? `${"  ".repeat(item.level)}- ${item.text}` : item.text);
    previousBullet = item.bullet;
  }
  return lines.join("\n");
}
