import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconTooltipButton } from "@/components/ui/icon-tooltip-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useT, type I18nKey } from "../../shared/i18n";
import type { AlignEdge, DistributeAxis } from "./align";
import { InspectorAlignRow } from "./align-ui";
import { IconInspector, readIconColor, readIconSize } from "./icon-inspector";
import { InspectorColourPicker } from "./inspector-colour-picker";
import { PROTOTYPE_STYLE_COLOUR_FALLBACK } from "./inspector-colour";
import {
  STYLE_EFFECTS,
  mixedStyleValue,
  wireframeElementBoxStyle,
  type StylePatch,
  type StyleTarget,
} from "./inspector-model";
import { iconDisplayLabel } from "./icons";
import { ElementFace } from "./elements";
import { InspectorAutoLayoutPanel } from "./inspector-auto-layout";
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

const FIELD_SELECT_CLASS =
  "h-8 min-w-0 w-full max-w-full rounded-md border border-input bg-transparent px-2 text-xs";

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
  documentColours,
  onReplaceElement,
}: {
  inspect: WireframeElement | null;
  selection: WireframeElement[];
  canvas: WireframeCanvas;
  documentColours: string[];
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
  onReplaceElement: (el: WireframeElement) => void;
}) {
  const t = useT();
  const [lockAspect, setLockAspect] = useState(() => inspect?.props.lockAspect === true);
  useEffect(() => {
    setLockAspect(inspect?.props.lockAspect === true);
  }, [inspect?.id, inspect?.props.lockAspect]);
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
        <InspectorColourPicker
          label={t("protoBackground")}
          value={canvas.background}
          fallback={PROTOTYPE_STYLE_COLOUR_FALLBACK.canvas}
          documentColours={documentColours}
          onChange={(value) => onCanvas({ background: value })}
        />
      </div>
    );
  }

  const previewEl = inspect ? { ...inspect, ...(selection[0] ?? inspect) } : null;
  const rotation = typeof inspect?.props.rotation === "number" ? inspect.props.rotation : 0;
  const fontFamily = typeof inspect?.props.fontFamily === "string" ? inspect.props.fontFamily : "system";
  const lineHeight = typeof inspect?.props.lineHeight === "number" ? inspect.props.lineHeight : 1.4;
  const verticalAlign = typeof inspect?.props.verticalAlign === "string" ? inspect.props.verticalAlign : "top";
  const padding = typeof inspect?.props.padding === "number" ? inspect.props.padding : 0;
  const italic = inspect?.props.italic === true;
  const underline = inspect?.props.underline === true;

  const toggleSection = (id: string) => setOpenSections((was) => ({ ...was, [id]: !was[id] }));

  return (
    <TooltipProvider delayDuration={400}>
    <div className="min-w-0 space-y-2 text-xs">
      {multi ? <div className="text-muted-foreground">{t("protoMultiSelection", { count: selection.length })}</div> : null}
      {!multi && inspect ? (
        <label className="grid gap-1">
          <span className="text-muted-foreground">{t("protoLabel")}</span>
          <Input className="h-8" value={inspect.label} onChange={(event) => updateOne({ label: event.target.value || inspect.type })} />
        </label>
      ) : null}

      <InspectorAlignRow selectionCount={selection.length} applyAlign={applyAlign} applyDistribute={applyDistribute} />

      <CollapseSection title={t("protoStyleSectionGeometry")} open={openSections.geometry} onToggle={() => toggleSection("geometry")}>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <ScrubField prefix="X" value={inspect?.x ?? 0} mixed={multi && new Set(selection.map((el) => el.x)).size > 1} onChange={(value) => updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, x: snap(value) } : el))} />
          <ScrubField prefix="Y" value={inspect?.y ?? 0} mixed={multi && new Set(selection.map((el) => el.y)).size > 1} onChange={(value) => updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, y: snap(value) } : el))} />
          <div className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
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
            <IconTooltipButton
              label={t("protoLockAspect")}
              pressed={lockAspect}
              onClick={() => {
                const next = !lockAspect;
                setLockAspect(next);
                setProp("lockAspect", next);
              }}
            >
              <Icon name={lockAspect ? "Lock" : "SquareUnlock02"} className="size-4" />
            </IconTooltipButton>
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
          </div>
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

      <InspectorAutoLayoutPanel
        inspect={inspect}
        selection={selection}
        onUpdate={(el) => onReplaceElement(el)}
        onUpdateChild={(el) => onReplaceElement(el)}
      />

      <CollapseSection title={t("protoStyleSectionConstraints")} open={openSections.constraints} onToggle={() => toggleSection("constraints")}>
        {inspect ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("protoConstraintHorizontal")}</span>
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2"
                value={inspect.constraints?.horizontal ?? "left"}
                onChange={(event) =>
                  updateOne({
                    constraints: {
                      horizontal: event.target.value as NonNullable<typeof inspect.constraints>["horizontal"],
                      vertical: inspect.constraints?.vertical ?? "top",
                    },
                  })
                }
              >
                <option value="left">{t("protoConstraintLeft")}</option>
                <option value="right">{t("protoConstraintRight")}</option>
                <option value="leftRight">{t("protoConstraintLeftRight")}</option>
                <option value="center">{t("protoAlignCenter")}</option>
                <option value="scale">{t("protoConstraintScale")}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("protoConstraintVertical")}</span>
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2"
                value={inspect.constraints?.vertical ?? "top"}
                onChange={(event) =>
                  updateOne({
                    constraints: {
                      horizontal: inspect.constraints?.horizontal ?? "left",
                      vertical: event.target.value as NonNullable<typeof inspect.constraints>["vertical"],
                    },
                  })
                }
              >
                <option value="top">{t("protoConstraintTop")}</option>
                <option value="bottom">{t("protoConstraintBottom")}</option>
                <option value="topBottom">{t("protoConstraintTopBottom")}</option>
                <option value="center">{t("protoAlignCenter")}</option>
                <option value="scale">{t("protoConstraintScale")}</option>
              </select>
            </label>
          </div>
        ) : (
          <p className="text-muted-foreground">{t("protoConstraintsHint")}</p>
        )}
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
              <div className="absolute inset-0 overflow-hidden" style={wireframeElementBoxStyle(previewEl, styleTarget)}>
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
        <label className="mb-2 grid min-w-0 gap-1">
          <span className="text-muted-foreground">{t("protoFontFamily")}</span>
          <select className={FIELD_SELECT_CLASS} value={fontFamily} onChange={(event) => setProp("fontFamily", event.target.value)}>
            {FONT_FAMILIES.map((font) => (
              <option key={font.id} value={font.id} style={{ fontFamily: font.css }}>{t(font.labelKey)}</option>
            ))}
          </select>
        </label>
        <div className="mb-2 grid min-w-0 grid-cols-2 gap-2">
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-muted-foreground">{t("protoPropFontWeight")}</span>
            <select
              className={FIELD_SELECT_CLASS}
              value={String(mixedStyleValue(selection, styleTarget, "fontWeight") ?? "400")}
              onChange={(event) => applyStyleField("fontWeight", event.target.value)}
            >
              {FONT_WEIGHTS.map((item) => (
                <option key={item.value} value={item.value}>{t(item.labelKey)}</option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-muted-foreground">{t("protoPropFontSize")}</span>
            <select
              className={FIELD_SELECT_CLASS}
              value={String(mixedStyleValue(selection, styleTarget, "fontSize") ?? 14)}
              onChange={(event) => applyStyleField("fontSize", Number(event.target.value))}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mb-2 grid min-w-0 gap-1">
          <span className="text-muted-foreground">{t("protoLineHeight")}</span>
          <ScrubField
            prefix="%"
            value={Math.round(lineHeight * 100)}
            mixed={false}
            onChange={(value) => setProp("lineHeight", value / 100)}
          />
        </label>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          <IconToggleGroup>
            {(
              [
                ["left", "protoTextAlignLeft", "TextAlignLeft"],
                ["center", "protoTextAlignCenter", "TextAlignCenter"],
                ["right", "protoTextAlignRight", "TextAlignRight"],
              ] as const
            ).map(([align, labelKey, icon]) => (
              <IconTooltipButton
                key={align}
                label={t(labelKey)}
                pressed={mixedStyleValue(selection, styleTarget, "textAlign") === align}
                onClick={() => applyStyleField("textAlign", align)}
              >
                <Icon name={icon} className="size-4" />
              </IconTooltipButton>
            ))}
          </IconToggleGroup>
          <IconToggleGroup>
            {(
              [
                ["top", "protoVerticalAlignTop", "LayoutAlignTop"],
                ["middle", "protoVerticalAlignMiddle", "AlignVerticalCenter"],
                ["bottom", "protoVerticalAlignBottom", "LayoutAlignBottom"],
              ] as const
            ).map(([align, labelKey, icon]) => (
              <IconTooltipButton
                key={align}
                label={t(labelKey)}
                pressed={verticalAlign === align}
                onClick={() => setProp("verticalAlign", align)}
              >
                <Icon name={icon} className="size-4" />
              </IconTooltipButton>
            ))}
          </IconToggleGroup>
          <IconToggleGroup>
            <IconTooltipButton
              label={t("protoTextBold")}
              pressed={mixedStyleValue(selection, styleTarget, "fontWeight") === "700" || mixedStyleValue(selection, styleTarget, "fontWeight") === 700}
              onClick={() => applyStyleField("fontWeight", mixedStyleValue(selection, styleTarget, "fontWeight") === 700 ? 400 : 700)}
            >
              <span className="text-sm font-bold leading-none">B</span>
            </IconTooltipButton>
            <IconTooltipButton label={t("protoTextItalic")} pressed={italic} onClick={() => setProp("italic", !italic)}>
              <span className="text-sm italic leading-none">I</span>
            </IconTooltipButton>
            <IconTooltipButton label={t("protoTextUnderline")} pressed={underline} onClick={() => setProp("underline", !underline)}>
              <span className="text-sm underline leading-none">U</span>
            </IconTooltipButton>
          </IconToggleGroup>
        </div>
        <InspectorColourPicker
          label={t("protoPropColor")}
          value={typeof mixedStyleValue(selection, styleTarget, "color") === "string" ? (mixedStyleValue(selection, styleTarget, "color") as string) : undefined}
          fallback={PROTOTYPE_STYLE_COLOUR_FALLBACK.text}
          mixed={mixedStyleValue(selection, styleTarget, "color") === "mixed"}
          documentColours={documentColours}
          onChange={(value) => applyStyleField("color", value)}
        />
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionFill")} open={openSections.fill} onToggle={() => toggleSection("fill")}>
        <InspectorColourPicker
          label={t("protoPropFill")}
          value={typeof mixedStyleValue(selection, styleTarget, "fill") === "string" ? (mixedStyleValue(selection, styleTarget, "fill") as string) : undefined}
          fallback={PROTOTYPE_STYLE_COLOUR_FALLBACK.fill}
          mixed={mixedStyleValue(selection, styleTarget, "fill") === "mixed"}
          documentColours={documentColours}
          onChange={(value) => applyStyleField("fill", value)}
        />
      </CollapseSection>

      <CollapseSection title={t("protoStyleSectionBorder")} open={openSections.border} onToggle={() => toggleSection("border")}>
        <InspectorColourPicker
          label={t("protoPropStroke")}
          value={typeof mixedStyleValue(selection, styleTarget, "stroke") === "string" ? (mixedStyleValue(selection, styleTarget, "stroke") as string) : undefined}
          fallback={PROTOTYPE_STYLE_COLOUR_FALLBACK.stroke}
          mixed={mixedStyleValue(selection, styleTarget, "stroke") === "mixed"}
          documentColours={documentColours}
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
    </TooltipProvider>
  );
}

function CollapseSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border">
      <button type="button" className="flex w-full items-center gap-1 px-2 py-1.5 text-left font-medium" onClick={onToggle}>
        <Icon name="ChevronDown" className={cn("size-3.5 shrink-0", !open && "-rotate-90")} />
        {title}
      </button>
      {open ? <div className="min-w-0 space-y-2 border-t border-border p-2">{children}</div> : null}
    </div>
  );
}

function IconToggleGroup({ children }: { children: ReactNode }) {
  return <div className="inline-flex max-w-full shrink-0 flex-wrap gap-0.5 rounded-md border border-border p-0.5">{children}</div>;
}

function ScrubField({
  prefix,
  suffix,
  value,
  mixed,
  onChange,
}: {
  prefix: string;
  suffix?: string;
  value: number;
  mixed?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-1 rounded border border-input px-1">
      <span
        className="shrink-0 cursor-ew-resize select-none text-muted-foreground"
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
      {suffix ? <span className="shrink-0 pr-1 text-muted-foreground">{suffix}</span> : null}
    </label>
  );
}
