// Office Viewer — PowerPoint text: paragraphs and runs resolved against the
// list styles they inherit (presentation defaults, master, layout, shape),
// turned into CSS the viewer can apply directly.
import type { CSSProperties } from "react";
import { kid, kids, type Xml } from "./xml.ts";
import { colorIn, css, hex, typeface, type Colors, type Rgba } from "./pptx-style.ts";

export type Run = { text: string; css: CSSProperties };
export type Para = { runs: Run[]; css: CSSProperties; bullet?: { text: string; css: CSSProperties; width: number }; level: number; text: string };
export type Body = { paras: Para[]; anchor: "flex-start" | "center" | "flex-end"; pad: [number, number, number, number]; wrap: boolean; vertical: 0 | 90 | 270 };
/** Text properties a table style gives its cells; runs and list styles that say otherwise win only for the size and font. */
export type TextBase = { color?: Rgba; b?: boolean };
export type BodyOptions = {
  /** `<a:lstStyle>`-like nodes holding `<a:lvl1pPr>`…, lowest priority first. */
  sources: (Xml | undefined)[];
  /** Merged `<a:bodyPr>` attributes (insets, anchor, wrap, vert). */
  attrs: Record<string, string>;
  /** The autofit element (`<a:normAutofit fontScale="…"/>`), if any. */
  fit?: Xml;
  base?: TextBase;
  /** What a slide-number field shows. */
  number: number;
};

type RProps = { sz?: number; b?: boolean; i?: boolean; u?: boolean; strike?: boolean; baseline?: number; cap?: boolean; spc?: number; color?: Rgba; font?: string; link?: boolean };
type Bullet = { kind: "none" } | { kind: "char"; char: string } | { kind: "num"; type: string; start: number };
type Spacing = { pct: number } | { pts: number };
type PProps = { marL?: number; indent?: number; algn?: string; lnSpc?: Spacing; spcBef?: Spacing; spcAft?: Spacing; bu?: Bullet; buClr?: Rgba; buSz?: number; buFont?: string; r?: RProps };

const flag = (value: string | undefined) => value === "1" || value === "true";
/** A line is about 1.2 times the font size, and so is a "100%" line spacing. */
const LINE = 1.2;
const PX_PER_HUNDREDTH_PT = 1 / 75;
const PX_PER_PT = 4 / 3;

function readRPr(node: Xml | undefined, colors: Colors): RProps {
  const r: RProps = {};
  if (!node) return r;
  const a = node.attrs;
  if (a.sz) r.sz = Number(a.sz);
  if (a.b !== undefined) r.b = flag(a.b);
  if (a.i !== undefined) r.i = flag(a.i);
  if (a.u !== undefined) r.u = a.u !== "none";
  if (a.strike !== undefined) r.strike = a.strike !== "noStrike";
  if (a.baseline !== undefined) r.baseline = Number(a.baseline);
  if (a.cap !== undefined) r.cap = a.cap !== "none";
  if (a.spc !== undefined) r.spc = Number(a.spc);
  const color = colorIn(kid(node, "a:solidFill"), colors);
  if (color) r.color = color;
  const font = typeface(kid(node, "a:latin")?.attrs.typeface, colors.theme);
  if (font) r.font = font;
  if (kid(node, "a:hlinkClick")) r.link = true;
  return r;
}

function spacing(node: Xml | undefined): Spacing | undefined {
  const pct = kid(node, "a:spcPct")?.attrs.val;
  const pts = kid(node, "a:spcPts")?.attrs.val;
  return pct !== undefined ? { pct: Number(pct) / 100000 } : pts !== undefined ? { pts: Number(pts) / 100 } : undefined;
}

function readPPr(node: Xml | undefined, colors: Colors): PProps {
  const p: PProps = {};
  if (!node) return p;
  const a = node.attrs;
  if (a.marL !== undefined) p.marL = Number(a.marL) / 9525;
  if (a.indent !== undefined) p.indent = Number(a.indent) / 9525;
  if (a.algn) p.algn = a.algn;
  const lnSpc = spacing(kid(node, "a:lnSpc"));
  const spcBef = spacing(kid(node, "a:spcBef"));
  const spcAft = spacing(kid(node, "a:spcAft"));
  if (lnSpc) p.lnSpc = lnSpc;
  if (spcBef) p.spcBef = spcBef;
  if (spcAft) p.spcAft = spcAft;
  const char = kid(node, "a:buChar")?.attrs.char;
  const numbered = kid(node, "a:buAutoNum");
  if (kid(node, "a:buNone")) p.bu = { kind: "none" };
  else if (char !== undefined) p.bu = { kind: "char", char };
  else if (numbered) p.bu = { kind: "num", type: numbered.attrs.type ?? "arabicPeriod", start: Number(numbered.attrs.startAt ?? 1) };
  const buClr = colorIn(kid(node, "a:buClr"), colors);
  if (buClr) p.buClr = buClr;
  const buSz = kid(node, "a:buSzPct")?.attrs.val;
  if (buSz) p.buSz = Number(buSz) / 100000;
  const buFont = kid(node, "a:buFont")?.attrs.typeface;
  if (buFont) p.buFont = buFont;
  const r = readRPr(kid(node, "a:defRPr"), colors);
  if (Object.keys(r).length) p.r = r;
  return p;
}

const mergeP = (low: PProps, high: PProps): PProps => ({ ...low, ...high, r: { ...low.r, ...high.r } });

/** Glyphs Word and PowerPoint store as Wingdings/Symbol letters or private-use code points. */
const SYMBOLS: Record<string, string> = { "§": "▪", "Ø": "➢", "ü": "✓", v: "❖", q: "❑", "·": "•", n: "■", l: "●", o: "○", "þ": "☑", "û": "✗", "": "•", "": "▪", "": "➢", "": "✓", "": "❖", "": "□" };

function bulletGlyph(char: string, font: string | undefined) {
  if (/wingdings|symbol/i.test(font ?? "") || char in SYMBOLS) return SYMBOLS[char] ?? "•";
  return char;
}

function roman(value: number) {
  let rest = value;
  let out = "";
  for (const [size, letters] of [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]] as const) {
    while (rest >= size) {
      out += letters;
      rest -= size;
    }
  }
  return out;
}

/** "1." / "a)" / "(iv)" for an auto-numbered paragraph, by the file's numbering scheme. */
export function numberLabel(type: string, value: number): string {
  const alpha = String.fromCharCode(97 + ((value - 1) % 26));
  const body = type.startsWith("alphaLc") ? alpha : type.startsWith("alphaUc") ? alpha.toUpperCase() : type.startsWith("romanLc") ? roman(value) : type.startsWith("romanUc") ? roman(value).toUpperCase() : String(value);
  if (type.endsWith("ParenBoth")) return `(${body})`;
  if (type.endsWith("ParenR")) return `${body})`;
  return type.endsWith("Plain") ? body : `${body}.`;
}

const SERIF = /times|georgia|cambria|garamond|palatino|book antiqua|baskerville|minion|serif/i;
const MONO = /consolas|courier|mono|menlo|lucida console/i;
const family = (name: string) => `"${name.replace(/"/g, "")}", ${MONO.test(name) ? "monospace" : SERIF.test(name) && !/sans/i.test(name) ? "serif" : "sans-serif"}`;

function runCss(r: RProps, scale: number, colors: Colors): CSSProperties {
  const out: CSSProperties = {};
  const size = (r.sz ?? 1800) * PX_PER_HUNDREDTH_PT * scale;
  out.fontSize = r.baseline ? size * 0.7 : size;
  if (r.b) out.fontWeight = 700;
  if (r.i) out.fontStyle = "italic";
  const decoration = [r.u || r.link ? "underline" : "", r.strike ? "line-through" : ""].filter(Boolean).join(" ");
  if (decoration) out.textDecoration = decoration;
  const color = r.color ?? (r.link ? hex(colors.theme.colors.hlink) : undefined);
  if (color) out.color = css(color);
  if (r.font) out.fontFamily = family(r.font);
  if (r.baseline) out.verticalAlign = r.baseline > 0 ? "super" : "sub";
  if (r.cap) out.textTransform = "uppercase";
  if (r.spc) out.letterSpacing = r.spc * PX_PER_HUNDREDTH_PT;
  return out;
}

const ALIGN: Record<string, CSSProperties["textAlign"]> = { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" };
const ANCHOR: Record<string, Body["anchor"]> = { t: "flex-start", ctr: "center", b: "flex-end" };

/** A text body (`<p:txBody>`, `<a:txBody>`) with every inherited property applied. */
export function buildBody(tx: Xml | undefined, options: BodyOptions, colors: Colors): Body | undefined {
  if (!tx) return undefined;
  const { attrs, fit, base } = options;
  const scale = fit?.name === "a:normAutofit" ? Number(fit.attrs.fontScale ?? 100000) / 100000 : 1;
  const reduction = fit?.name === "a:normAutofit" ? Number(fit.attrs.lnSpcReduction ?? 0) / 100000 : 0;
  const inset = (name: string, fallback: number) => Number(attrs[name] ?? fallback) / 9525;
  const numbers: (number | undefined)[] = [];
  const paras: Para[] = [];
  for (const p of kids(tx, "a:p")) {
    const pPr = kid(p, "a:pPr");
    const level = Math.min(8, Number(pPr?.attrs.lvl ?? 0) || 0);
    let props: PProps = {};
    for (const source of options.sources) props = mergeP(props, readPPr(kid(source, `a:lvl${level + 1}pPr`), colors));
    props = mergeP(props, readPPr(pPr, colors));
    const baseR: RProps = { ...props.r, ...(base?.color ? { color: base.color } : {}), ...(base?.b ? { b: true } : {}) };
    const runs: Run[] = [];
    let text = "";
    for (const child of p.kids) {
      const style = runCss({ ...baseR, ...readRPr(kid(child, "a:rPr"), colors) }, scale, colors);
      if (child.name === "a:r" || child.name === "a:fld") {
        const value = child.attrs.type === "slidenum" ? String(options.number) : (kid(child, "a:t")?.text ?? "");
        if (value) runs.push({ text: value, css: style });
        text += value;
      } else if (child.name === "a:br") {
        runs.push({ text: "\n", css: style });
        text += " ";
      }
    }
    const endR = readRPr(kid(p, "a:endParaRPr"), colors);
    const size = ((runs.length ? undefined : endR.sz) ?? baseR.sz ?? 1800) * PX_PER_HUNDREDTH_PT * scale;
    const lines = props.lnSpc;
    const fontSize = Number(runs[0]?.css.fontSize ?? size);
    const space = (value: Spacing | undefined) => (value ? ("pts" in value ? value.pts * PX_PER_PT : value.pct * LINE * fontSize) : 0);
    const bullet = props.bu;
    const para: Para = {
      runs,
      level,
      text: text.trim(),
      css: {
        fontSize: size,
        textAlign: ALIGN[props.algn ?? "l"] ?? "left",
        lineHeight: lines && "pts" in lines ? `${lines.pts * PX_PER_PT}px` : ((lines && "pct" in lines ? lines.pct : 1) - reduction) * LINE,
        marginTop: space(props.spcBef),
        marginBottom: space(props.spcAft),
        paddingLeft: props.marL ?? 0,
        textIndent: bullet && bullet.kind !== "none" ? 0 : (props.indent ?? 0),
      },
    };
    numbers.length = level + 1;
    if (text && bullet && bullet.kind !== "none") {
      let glyph: string;
      if (bullet.kind === "num") {
        numbers[level] = (numbers[level] ?? bullet.start - 1) + 1;
        glyph = numberLabel(bullet.type, numbers[level]!);
      } else {
        numbers[level] = undefined;
        glyph = bulletGlyph(bullet.char, props.buFont);
      }
      const first = runs[0]?.css ?? {};
      const bulletSize = Number(first.fontSize ?? size) * (props.buSz ?? 1);
      para.bullet = {
        text: glyph,
        width: Math.max(-(props.indent ?? 0), bulletSize),
        css: {
          ...first,
          fontSize: bulletSize,
          textDecoration: "none",
          ...(props.buClr ? { color: css(props.buClr) } : {}),
          ...(props.buFont && !/wingdings|symbol/i.test(props.buFont) ? { fontFamily: family(props.buFont) } : {}),
        },
      };
    } else if (!bullet || bullet.kind === "none") numbers[level] = undefined;
    paras.push(para);
  }
  return {
    paras,
    anchor: ANCHOR[attrs.anchor ?? "t"] ?? "flex-start",
    pad: [inset("lIns", 91440), inset("tIns", 45720), inset("rIns", 91440), inset("bIns", 45720)],
    wrap: attrs.wrap !== "none",
    vertical: attrs.vert === "vert270" ? 270 : attrs.vert?.startsWith("vert") || attrs.vert === "eaVert" ? 90 : 0,
  };
}
