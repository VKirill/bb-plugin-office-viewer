// Office Viewer — draws a parsed PowerPoint slide: absolutely positioned shapes
// at the slide's natural pixel size, scaled to fit by the caller.
import { memo } from "react";
import type { CSSProperties } from "react";
import { arrowhead, outline, textInset } from "./pptx-geometry";
import type { Fill } from "./pptx-style";
import type { Body } from "./pptx-text";
import type { Deck, Shape, Slide } from "./pptx";
import { t } from "../shared/i18n";

function fillStyle(fill: Fill): CSSProperties {
  if (fill.kind === "solid") return { background: fill.color };
  if (fill.kind === "image") return { background: `url("${fill.url}") center / 100% 100% no-repeat` };
  if (fill.kind === "grad") {
    const stops = fill.stops.map((stop) => `${stop.color} ${stop.pos}%`).join(", ");
    return { background: fill.radial ? `radial-gradient(circle at center, ${stops})` : `linear-gradient(${fill.angle + 90}deg, ${stops})` };
  }
  return {};
}

const flipOf = (shape: { flipH: boolean; flipV: boolean }) => (shape.flipH || shape.flipV ? `scale(${shape.flipH ? -1 : 1}, ${shape.flipV ? -1 : 1})` : undefined);

function Paragraphs({ body }: { body: Body }) {
  return (
    <>
      {body.paras.map((para, index) => (
        <div key={index} style={para.css}>
          {para.bullet ? <span style={{ ...para.bullet.css, display: "inline-block", width: para.bullet.width, marginLeft: -para.bullet.width }}>{para.bullet.text}</span> : null}
          {para.runs.length
            ? para.runs.map((run, i) => (run.text === "\n" ? <br key={i} /> : <span key={i} style={run.css}>{run.text}</span>))
            : <br />}
        </div>
      ))}
    </>
  );
}

function TextBox({ body, inset, width, height }: { body: Body; inset: number; width: number; height: number }) {
  const [left, top, right, bottom] = body.pad;
  const style: CSSProperties = {
    position: "absolute",
    left: inset * width,
    top: inset * height,
    right: inset * width,
    bottom: inset * height,
    boxSizing: "border-box",
    padding: `${top}px ${right}px ${bottom}px ${left}px`,
    display: "flex",
    flexDirection: "column",
    justifyContent: body.anchor,
    whiteSpace: body.wrap ? "pre-wrap" : "pre",
    overflowWrap: "break-word",
  };
  if (body.vertical) {
    style.writingMode = "vertical-rl";
    if (body.vertical === 270) style.transform = "rotate(180deg)";
  }
  return (
    <div style={style}>
      <Paragraphs body={body} />
    </div>
  );
}

function ShapeNode({ shape }: { shape: Shape }) {
  const base: CSSProperties = { position: "absolute", left: shape.x, top: shape.y, width: shape.w, height: shape.h, transform: shape.rot ? `rotate(${shape.rot}deg)` : undefined };
  if (shape.kind === "group") {
    return <div style={base}>{shape.children.map((child, index) => <ShapeNode key={index} shape={child} />)}</div>;
  }
  if (shape.kind === "unsupported") {
    const label = shape.label === "chart" ? t("slideChart") : shape.label === "diagram" ? t("slideDiagram") : t("slideObject");
    return <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed rgba(128, 128, 128, 0.6)", color: "rgba(100, 100, 100, 0.9)", fontSize: 20 }}>{label}</div>;
  }
  if (shape.kind === "pic") {
    const [left, top, right, bottom] = shape.crop;
    const scaleX = 1 / Math.max(0.01, 1 - left - right);
    const scaleY = 1 / Math.max(0.01, 1 - top - bottom);
    const radius = shape.round === "ellipse" ? "50%" : shape.round;
    return (
      <div style={{ ...base, transform: [base.transform, flipOf(shape)].filter(Boolean).join(" ") || undefined, overflow: "hidden", borderRadius: radius, opacity: shape.opacity }}>
        <img
          src={shape.url}
          alt=""
          draggable={false}
          style={{ position: "absolute", maxWidth: "none", width: shape.w * scaleX, height: shape.h * scaleY, left: -left * shape.w * scaleX, top: -top * shape.h * scaleY }}
        />
        {shape.line ? <div style={{ position: "absolute", inset: 0, borderRadius: radius, border: `${shape.line.width}px solid ${shape.line.color}` }} /> : null}
      </div>
    );
  }
  if (shape.kind === "table") {
    return (
      <div style={{ ...base, height: undefined }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: shape.cols.reduce((sum, col) => sum + col, 0) }}>
          <colgroup>{shape.cols.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
          <tbody>
            {shape.rows.map((row, r) => (
              <tr key={r} style={{ height: row.h }}>
                {row.cells.map((cell, c) =>
                  cell.skip ? null : (
                    <td
                      key={c}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      style={{ ...cell.css, padding: `${cell.body.pad[1]}px ${cell.body.pad[2]}px ${cell.body.pad[3]}px ${cell.body.pad[0]}px`, verticalAlign: cell.body.anchor === "center" ? "middle" : cell.body.anchor === "flex-end" ? "bottom" : "top", overflowWrap: "break-word" }}
                    >
                      <Paragraphs body={cell.body} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const path = outline(shape.geometry, shape.w, shape.h);
  const flip = flipOf(shape);
  const line = shape.line;
  const size = line ? Math.max(8, line.width * 3) : 0;
  return (
    <div style={base}>
      {shape.fill && shape.fill.kind !== "none" && !path.line ? (
        <div style={{ position: "absolute", inset: 0, ...fillStyle(shape.fill), clipPath: path.rect ? undefined : `path(${path.evenodd ? "evenodd, " : ""}'${path.d}')`, transform: flip }} />
      ) : null}
      {line ? (
        <svg width={Math.max(shape.w, 1)} height={Math.max(shape.h, 1)} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", transform: flip }} aria-hidden>
          <path d={path.d} fill="none" stroke={line.color} strokeWidth={line.width} strokeDasharray={line.dash.length ? line.dash.map((part) => part * line.width).join(" ") : undefined} strokeLinejoin="round" />
          {line.head && path.start ? <path d={arrowhead(path.start, path.start.angle, size)} fill={line.color} /> : null}
          {line.tail && path.end ? <path d={arrowhead(path.end, path.end.angle, size)} fill={line.color} /> : null}
        </svg>
      ) : null}
      {shape.body ? <TextBox body={shape.body} inset={textInset(shape.geometry)} width={shape.w} height={shape.h} /> : null}
    </div>
  );
}

/** A slide at its natural pixel size. */
export const SlideView = memo(function SlideView({ deck, slide }: { deck: Deck; slide: Slide }) {
  const background = slide.background && slide.background.kind !== "none" ? fillStyle(slide.background) : {};
  return (
    <div style={{ position: "relative", overflow: "hidden", width: deck.width, height: deck.height, background: "#ffffff", color: "#000000", fontFamily: "Calibri, Carlito, Arial, sans-serif", ...background }}>
      {slide.shapes.map((shape, index) => <ShapeNode key={index} shape={shape} />)}
    </div>
  );
});

/** A slide scaled down (or up) to the given width. */
export function ScaledSlide({ deck, slide, width }: { deck: Deck; slide: Slide; width: number }) {
  const scale = width / deck.width;
  return (
    <div style={{ position: "relative", overflow: "hidden", width, height: deck.height * scale }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: deck.width, height: deck.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <SlideView deck={deck} slide={slide} />
      </div>
    </div>
  );
}
