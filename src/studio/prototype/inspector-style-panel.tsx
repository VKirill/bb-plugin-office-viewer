import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useT, type I18nKey } from "../../shared/i18n";
import type { AlignEdge, DistributeAxis } from "./align";
import { IconInspector, readIconColor, readIconSize } from "./icon-inspector";
import { InspectorColourPicker } from "./inspector-colour-picker";
import {
  STYLE_EFFECTS,
  mixedStyleValue,
  resolveStylePatch,
  stylePatchToInline,
  type StylePatch,
  type StyleTarget,
} from "./inspector-model";
import { iconDisplayLabel } from "./icons";
import { ElementFace } from "./elements";
import { SNAP, snap, type PropValue, type WireframeCanvas, type WireframeElement } from "./model";

const STYLE_EFFECT_LABEL: Record<(typeof STYLE_EFFECTS)[number], I18nKey> = {
  hover: "protoStyleHover",
  pressed: "protoStylePressed",
  selected: "protoStyleSelected",
  disabled: "protoStyleDisabled",
  focus: "protoStyleFocus",
};

const FONT_FAMILIES: { id: string; labelKey: I18nKey; css: string }[] = [
  { id: "system", labelKey: "protoFontSystem", css: "system-ui, sans-serif" },
  { id: "serif", labelKey: "protoFontSerif", css: "Georgia, serif" },
  { id: "mono", labelKey: "protoFontMono", css: "ui-monospace, monospace" },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 32] as const;
const FONT_WEIGHTS: { value: string; labelKey: I18nKey }[] = [
  { value: "400", labelKey: "protoFontWeightRegular" },
  { value: "500", labelKey: "protoFontWeightMedium" },
  { value: "600", labelKey: "protoFontWeightSemibold" },
  { value: "700", labelKey: "protoFontWeightBold" },
];

export function InspectorStylePanel({
  inspect,
  selection,
  canvas,
  multi,
  styleTarget,
  setStyleTarget,
  applyStyleField,
  updateOne,
  updateMany,
  setProp,
  onCanvas,
  applyAlign,
  applyDistribute,
}: {
  inspect: WireframeElement | null;
  selection: WireframeElement[];
  canvas: WireframeCanvas;
  multi: boolean;
  styleTarget: StyleTarget;
  setStyleTarget: (target: StyleTarget) => void;
  applyStyleField: (key: keyof StylePatch, value: PropValue | undefined) => void;
  updateOne: (patch: Partial<WireframeElement>) => void;
  updateMany: (mapper: (el: WireframeElement) => WireframeElement) => void;
  setProp: (key: string, value: PropValue) => void;
  onCanvas: (patch: Partial<WireframeCanvas>) => void;
  applyAlign: (edge: AlignEdge) => void;
  applyDistribute: (axis: DistributeAxis) => void;
}) {
  const t = useT();
  const [lockAspect, setLockAspect] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    geometry: true,
    text: true,
    fill: true,
    border: true,
    shadow: true,
    padding: false,
    constraints: false,
    widget: true,
    opacity: true,
  });

  if (!selection.length) {
    return (
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">{t("protoNoSelection")}</div>
        <InspectorColourPicker label={t("protoBackground")} value={canvas.background} onChange={(value) => onCanvas({ background: value })} />
      </div>
    );
  }

  const previewEl = inspect ? { ...inspect, ...(selection[0] ?? inspect) } : null;
  const previewPatch = previewEl ? resolveStylePatch(previewEl, styleTarget) : {};
  const rotation = typeof inspect?.props.rotation === "number" ? inspect.props.rotation : 0;
  const fontFamily = typeof inspect?.props.fontFamily === "string" ? inspect.props.fontFamily : "system";
  const lineHeight = typeof inspect?.props.lineHeight === "number" ? inspect.props.lineHeight : 1.4;
  const verticalAlign = typeof inspect?.props.verticalAlign === "string" ? inspect.props.verticalAlign : "top";
  const padding = typeof inspect?.props.padding === "number" ? inspect.props.padding : 0;
  const italic = inspect?.props.italic === true;
  const underline = inspect?.props.underline === true;

  const toggleSection = (id: string) => setOpenSections((was) => ({ ...was, [id]: !was[id] }));

  return (
    <div className="space-y-2 text-xs">
      {multi ? <div className="text-muted-foreground">{t("protoMultiSelection", { count: selection.length })}</div> : null}
      {!multi && inspect ? (
        <label className="grid gap-1">
          <span className="text-muted-foreground">{t("protoLabel")}</span>
          <Input className="h-8" value={inspect.label} onChange={(event) => updateOne({ label: event.target.value || inspect.type })} />
        </label>
      ) : null}

      <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border p-1">
        {(
          [
            ["left", "protoAlignLeft"],
            ["center", "protoAlignCenter"],
            ["right", "protoAlignRight"],
            ["top", "protoAlignTop"],
            ["middle", "protoAlignMiddle"],
            ["bottom", "protoAlignBottom"],
            ["horizontal", "protoDistributeH"],
            ["lock", "protoLockAspect"],
            ["vertical", "protoDistributeV"],
          ] as const
        ).map(([kind, labelKey]) => {
          if (kind === "lock") {
            return (
              <span key={kind} title={t(labelKey)} className="inline-flex">
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t(labelKey)} aria-pressed={lockAspect} onClick={() => setLockAspect((on) => !on)}>
                  <Icon name={lockAspect ? "Lock" : "SquareUnlock02"} className="size-3.5" />
                </Button>
              </span>
            );
          }
          if (kind === "horizontal" || kind === "vertical") {
            return (
              <span key={kind} title={t(labelKey)} className="inline-flex">
                <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t(labelKey)} disabled={selection.length < 3} onClick={() => applyDistribute(kind)}>
                  <DistributeIcon axis={kind} />
                </Button>
              </span>
            );
          }
          return (
            <span key={kind} title={t(labelKey)} className="inline-flex">
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t(labelKey)} disabled={!selection.length} onClick={() => applyAlign(kind as AlignEdge)}>
                <AlignIcon kind={kind as AlignEdge} />
              </Button>
            </span>
          );
        })}
      </div>

      <CollapseSection title={t("protoStyleSectionGeometry")} open={openSections.geometry} onToggle={() => toggleSection("geometry")}>
        <div className="grid grid-cols-2 gap-2">
          <ScrubField prefix="X" value={inspect?.x ?? 0} mixed={multi && new Set(selection.map((el) => el.x)).size > 1} onChange={(value) => updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, x: snap(value) } : el))} />
          <ScrubField prefix="Y" value={inspect?.y ?? 0} mixed={multi && new Set(selection.map((el) => el.y)).size > 1} onChange={(value) => updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, y: snap(value) } : el))} />
          <ScrubField
            prefix="W"
            value={inspect?.w ?? 0}
            mixed={multi && new Set(selection.map((el) => el.w)).size > 1}
            onChange={(value) => {
              const w = Math.max(SNAP, snap(value));
              updateMany((el) => {
                if (!selection.some((s) => s.id === el.id)) return el;
                if (!lockAspect || !inspect) return { ...el, w };
                const ratio = el.h / el.w;
                return { ...el, w, h: Math.max(SNAP, snap(w * ratio)) };
              });
            }}
          />
          <ScrubField
            prefix="H"
            value={inspect?.h ?? 0}
            mixed={multi && new Set(selection.map((el) => el.h)).size > 1}
            onChange={(value) => {
              const h = Math.max(SNAP, snap(value));
              updateMany((el) => {
                if (!selection.some((s) => s.id === el.id)) return el;
                if (!lockAspect || !inspect) return { ...el, h };
                const ratio = el.w / el.h;
                return { ...el, h, w: Math.max(SNAP, snap(h * ratio)) };
              });
            }}
          />
          <ScrubField
            prefix="°"
            value={rotation}
            mixed={false}
            onChange={(value) => {
              updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, props: { ...el.props, rotation: value } } : el));
            }}
          />
          <ScrubField
            prefix="R"
            value={typeof mixedStyleValue(selection, styleTarget, "radius") === "number" ? (mixedStyleValue(selection, styleTarget, "radius") as number) : 0}
            mixed={mixedStyleValue(selection, styleTarget, "radius") === "mixed"}
            onChange={(value) => applyStyleField("radius", value)}
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2 h-7 w-full" onClick={() => {
          if (!inspect) return;
          updateOne({ w: Math.max(SNAP, snap(inspect.w)), h: Math.max(SNAP, snap(inspect.h)) });
        }}>
          {t("protoGeometryFit")}
        </Button>
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionConstraints")} open={openSections.constraints} onToggle={() => toggleSection("constraints")}>
        <p className="text-muted-foreground">{t("protoConstraintsHint")}</p>
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionWidget")} open={openSections.widget} onToggle={() => toggleSection("widget")}>
        <label className="grid gap-1">
          <span className="text-muted-foreground">{t("protoStyleEffect")}</span>
          <select className="h-8 rounded-md border border-input bg-transparent px-2 text-sm" value={styleTarget} onChange={(event) => setStyleTarget(event.target.value as StyleTarget)}>
            <option value="base">{t("protoStyleBase")}</option>
            {STYLE_EFFECTS.map((effect) => (
              <option key={effect} value={effect}>{t(STYLE_EFFECT_LABEL[effect])}</option>
            ))}
          </select>
        </label>
        {previewEl ? (
          <div className="mt-2 rounded border border-border bg-muted/30 p-2" style={{ minHeight: 48 }}>
            <div className="relative mx-auto" style={{ width: Math.min(120, previewEl.w), height: Math.min(80, previewEl.h) }}>
              <div className="absolute inset-0 overflow-hidden" style={stylePatchToInline(previewPatch)}>
                <ElementFace el={previewEl} />
              </div>
            </div>
          </div>
        ) : null}
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionOpacity")} open={openSections.opacity} onToggle={() => toggleSection("opacity")}>
        <ScrubField
          prefix="%"
          value={typeof mixedStyleValue(selection, styleTarget, "opacity") === "number" ? Math.round((mixedStyleValue(selection, styleTarget, "opacity") as number) * 100) : 100}
          mixed={mixedStyleValue(selection, styleTarget, "opacity") === "mixed"}
          onChange={(value) => applyStyleField("opacity", value / 100)}
        />
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionText")} open={openSections.text} onToggle={() => toggleSection("text")}>
        <label className="mb-2 grid gap-1">
          <span className="text-muted-foreground">{t("protoFontFamily")}</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            value={fontFamily}
            onChange={(event) => setProp("fontFamily", event.target.value)}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font.id} value={font.id} style={{ fontFamily: font.css }}>{t(font.labelKey)}</option>
            ))}
          </select>
        </label>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="text-muted-foreground">{t("protoPropFontWeight")}</span>
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              value={String(mixedStyleValue(selection, styleTarget, "fontWeight") ?? "400")}
              onChange={(event) => applyStyleField("fontWeight", event.target.value)}
            >
              {FONT_WEIGHTS.map((item) => (
                <option key={item.value} value={item.value}>{t(item.labelKey)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-muted-foreground">{t("protoPropFontSize")}</span>
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              value={String(mixedStyleValue(selection, styleTarget, "fontSize") ?? 14)}
              onChange={(event) => applyStyleField("fontSize", Number(event.target.value))}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </label>
        </div>
        <ScrubField prefix={t("protoLineHeight")} value={Math.round(lineHeight * 100)} mixed={false} onChange={(value) => setProp("lineHeight", value / 100)} />
        <div className="mt-2 flex flex-wrap gap-1">
          {(["left", "center", "right"] as const).map((align) => (
            <span key={align} title={t(align === "left" ? "protoTextAlignLeft" : align === "center" ? "protoTextAlignCenter" : "protoTextAlignRight")} className="inline-flex">
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-pressed={mixedStyleValue(selection, styleTarget, "textAlign") === align} aria-label={t(align === "left" ? "protoTextAlignLeft" : align === "center" ? "protoTextAlignCenter" : "protoTextAlignRight")} onClick={() => applyStyleField("textAlign", align)}>
                <TextAlignIcon align={align} />
              </Button>
            </span>
          ))}
          {(["top", "middle", "bottom"] as const).map((align) => (
            <span key={align} title={t(align === "top" ? "protoVerticalAlignTop" : align === "middle" ? "protoVerticalAlignMiddle" : "protoVerticalAlignBottom")} className="inline-flex">
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-pressed={verticalAlign === align} aria-label={t(align === "top" ? "protoVerticalAlignTop" : align === "middle" ? "protoVerticalAlignMiddle" : "protoVerticalAlignBottom")} onClick={() => setProp("verticalAlign", align)}>
                <VerticalAlignIcon align={align} />
              </Button>
            </span>
          ))}
          <span title={t("protoTextBold")} className="inline-flex"><Button type="button" variant="ghost" size="icon" className="size-7 font-bold" aria-pressed={mixedStyleValue(selection, styleTarget, "fontWeight") === "700" || mixedStyleValue(selection, styleTarget, "fontWeight") === 700} aria-label={t("protoTextBold")} onClick={() => applyStyleField("fontWeight", mixedStyleValue(selection, styleTarget, "fontWeight") === 700 ? 400 : 700)}>B</Button></span>
          <span title={t("protoTextItalic")} className="inline-flex"><Button type="button" variant="ghost" size="icon" className="size-7 italic" aria-pressed={italic} aria-label={t("protoTextItalic")} onClick={() => setProp("italic", !italic)}>I</Button></span>
          <span title={t("protoTextUnderline")} className="inline-flex"><Button type="button" variant="ghost" size="icon" className="size-7 underline" aria-pressed={underline} aria-label={t("protoTextUnderline")} onClick={() => setProp("underline", !underline)}>U</Button></span>
        </div>
        <InspectorColourPicker
          label={t("protoPropColor")}
          value={typeof mixedStyleValue(selection, styleTarget, "color") === "string" ? (mixedStyleValue(selection, styleTarget, "color") as string) : undefined}
          mixed={mixedStyleValue(selection, styleTarget, "color") === "mixed"}
          onChange={(value) => applyStyleField("color", value)}
        />
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionFill")} open={openSections.fill} onToggle={() => toggleSection("fill")}>
        <InspectorColourPicker
          label={t("protoPropFill")}
          value={typeof mixedStyleValue(selection, styleTarget, "fill") === "string" ? (mixedStyleValue(selection, styleTarget, "fill") as string) : undefined}
          mixed={mixedStyleValue(selection, styleTarget, "fill") === "mixed"}
          onChange={(value) => applyStyleField("fill", value)}
        />
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionBorder")} open={openSections.border} onToggle={() => toggleSection("border")}>
        <InspectorColourPicker
          label={t("protoPropStroke")}
          value={typeof mixedStyleValue(selection, styleTarget, "stroke") === "string" ? (mixedStyleValue(selection, styleTarget, "stroke") as string) : undefined}
          mixed={mixedStyleValue(selection, styleTarget, "stroke") === "mixed"}
          onChange={(value) => applyStyleField("stroke", value)}
        />
        <ScrubField
          prefix={t("protoPropStrokeWidth")}
          value={typeof mixedStyleValue(selection, styleTarget, "strokeWidth") === "number" ? (mixedStyleValue(selection, styleTarget, "strokeWidth") as number) : 0}
          mixed={mixedStyleValue(selection, styleTarget, "strokeWidth") === "mixed"}
          onChange={(value) => applyStyleField("strokeWidth", value)}
        />
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionShadow")} open={openSections.shadow} onToggle={() => toggleSection("shadow")}>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={mixedStyleValue(selection, styleTarget, "shadow") === true} disabled={mixedStyleValue(selection, styleTarget, "shadow") === "mixed"} onChange={(event) => applyStyleField("shadow", event.target.checked)} />
          <span>{t("protoPropShadow")}</span>
        </label>
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionPadding")} open={openSections.padding} onToggle={() => toggleSection("padding")}>
        <ScrubField prefix={t("protoPadding")} value={padding} mixed={false} onChange={(value) => setProp("padding", value)} />
      </CollapseSection>

      {inspect?.type === "Icon" && !multi ? (
        <IconInspector
          name={typeof inspect.props.name === "string" ? inspect.props.name : "Star"}
          size={readIconSize(inspect.props)}
          color={readIconColor(inspect.props)}
          onName={(iconName) => updateOne({ props: { ...inspect.props, name: iconName }, label: iconDisplayLabel(iconName) })}
          onSize={(value) => updateOne({ props: { ...inspect.props, size: value }, w: value, h: value })}
          onColor={(value) => setProp("color", value)}
        />
      ) : null}
    </div>
  );
}

function CollapseSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border">
      <button type="button" className="flex w-full items-center gap-1 px-2 py-1.5 text-left font-medium" onClick={onToggle}>
        <Icon name="ChevronDown" className={cn("size-3.5 shrink-0", !open && "-rotate-90")} />
        {title}
      </button>
      {open ? <div className="space-y-2 border-t border-border p-2">{children}</div> : null}
    </div>
  );
}

function ScrubField({ prefix, value, mixed, onChange }: { prefix: string; value: number; mixed?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center gap-1 rounded border border-input px-1">
      <span
        className="cursor-ew-resize select-none text-muted-foreground"
        onPointerDown={(event) => {
          event.preventDefault();
          const startY = event.clientY;
          const start = value;
          const onMove = (e: PointerEvent) => onChange(start + Math.round((startY - e.clientY) / 2));
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        {prefix}
      </span>
      <input
        type="number"
        className="h-7 min-w-0 flex-1 bg-transparent px-1 outline-none"
        value={mixed ? "" : value}
        placeholder={mixed ? "—" : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function AlignIcon({ kind }: { kind: AlignEdge }) {
  const path: Record<AlignEdge, string> = {
    left: "M3 3v10 M7 5h6",
    center: "M8 3v10 M4 5h8",
    right: "M13 3v10 M3 5h6",
    top: "M3 3h10 M5 7v6",
    middle: "M3 8h10 M5 4v8",
    bottom: "M3 13h10 M5 3v6",
  };
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <path d={path[kind]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TextAlignIcon({ align }: { align: "left" | "center" | "right" }) {
  const d = align === "left" ? "M2 4h10M2 8h6M2 12h8" : align === "center" ? "M3 4h10M5 8h6M4 12h8" : "M4 4h10M8 8h6M6 12h8";
  return <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden><path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function DistributeIcon({ axis }: { axis: "horizontal" | "vertical" }) {
  const d = axis === "horizontal" ? "M2 8h3 M7 8h2 M11 8h3" : "M8 2v3 M8 7v2 M8 11v3";
  return <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden><path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function VerticalAlignIcon({ align }: { align: "top" | "middle" | "bottom" }) {
  const d = align === "top" ? "M4 2v10M8 4v6M12 6v4" : align === "middle" ? "M4 5v6M8 3v10M12 5v6" : "M4 8v4M8 10v2M12 6v6";
  return <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden><path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
