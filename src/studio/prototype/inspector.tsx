import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { t, type I18nKey } from "../../shared/i18n";
import { IconInspector, readIconColor, readIconSize } from "./icon-inspector";
import type { Field } from "./inspector-fields";
import { INSPECTOR_FIELDS } from "./inspector-fields";
import { InspectorListDialog } from "./inspector-list-dialog";
import {
  LIST_EDITOR_TYPES,
  STYLE_EFFECTS,
  STYLE_TAB_FIELDS,
  listPropKey,
  mixedStyleValue,
  radioGroupOptions,
  readStringList,
  resolveStylePatch,
  stylePatchToInline,
  type StylePatch,
  type StyleTarget,
} from "./inspector-model";
import { InspectorTableEditor } from "./inspector-table-editor";
import { iconDisplayLabel } from "./icons";
import { ElementFace } from "./elements";
import { SNAP, snap, type PropValue, type WireframeCanvas, type WireframeElement } from "./model";

export type InspectorTab = "style" | "properties" | "notes";

const STYLE_EFFECT_LABEL: Record<(typeof STYLE_EFFECTS)[number], I18nKey> = {
  hover: "protoStyleHover",
  pressed: "protoStylePressed",
  selected: "protoStyleSelected",
  disabled: "protoStyleDisabled",
  focus: "protoStyleFocus",
};

export function PrototypeInspector({
  tab,
  setTab,
  inspect,
  selection,
  elements,
  canvas,
  pageNotes,
  noteMarkers,
  onNoteMarkers,
  onPageNotes,
  onCanvas,
  updateOne,
  updateMany,
  setProp,
  onReplaceElement,
  onRadioGroup,
  onRadioChecked,
}: {
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  inspect: WireframeElement | null;
  selection: WireframeElement[];
  elements: WireframeElement[];
  canvas: WireframeCanvas;
  pageNotes: string;
  noteMarkers: boolean;
  onNoteMarkers: (value: boolean) => void;
  onPageNotes: (value: string) => void;
  onCanvas: (patch: Partial<WireframeCanvas>) => void;
  updateOne: (patch: Partial<WireframeElement>) => void;
  updateMany: (mapper: (el: WireframeElement) => WireframeElement) => void;
  setProp: (key: string, value: PropValue) => void;
  onReplaceElement: (el: WireframeElement) => void;
  onRadioGroup: (groupId: string | null) => void;
  onRadioChecked: (checked: boolean) => void;
}) {
  const [styleTarget, setStyleTarget] = useState<StyleTarget>("base");
  const [listOpen, setListOpen] = useState(false);
  const listKey = inspect ? listPropKey(inspect.type) : null;
  const listItems = inspect && listKey ? readStringList(inspect, listKey) : [];
  const groups = useMemo(() => radioGroupOptions(elements), [elements]);
  const multi = selection.length > 1;

  const applyStyleField = (key: keyof StylePatch, value: PropValue | undefined) => {
    if (!selection.length) return;
    const patch: Partial<StylePatch> = { [key]: value as StylePatch[keyof StylePatch] };
    updateMany((el) => {
      if (!selection.some((item) => item.id === el.id)) return el;
      const style = el.style ?? {};
      if (styleTarget === "base") {
        return { ...el, style: { ...style, base: { ...(style.base ?? {}), ...patch } } };
      }
      const effects = { ...(style.effects ?? {}) };
      effects[styleTarget] = { ...(effects[styleTarget] ?? {}), ...patch };
      return { ...el, style: { ...style, effects } };
    });
  };

  const previewEl = inspect ? { ...inspect, ...(selection[0] ?? inspect) } : null;
  const previewPatch = previewEl ? resolveStylePatch(previewEl, styleTarget) : {};

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-background">
      <div className="flex gap-1 border-b border-border p-2">
        {(["style", "properties", "notes"] as InspectorTab[]).map((id) => (
          <button
            key={id}
            type="button"
            className={cn("flex-1 rounded px-2 py-1 text-xs font-medium", tab === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setTab(id)}
          >
            {t(id === "style" ? "protoTabStyle" : id === "properties" ? "protoTabProperties" : "protoTabNotes")}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {tab === "notes" ? (
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">{t("protoPageNotes")}</span>
            <Textarea value={pageNotes} onChange={(event) => onPageNotes(event.target.value)} rows={inspect ? 4 : 10} />
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={noteMarkers} onChange={(event) => onNoteMarkers(event.target.checked)} />
              {t("protoNoteMarkers")}
            </label>
            {inspect ? (
              <>
                <span className="mt-3 text-xs text-muted-foreground">{t("protoNote")}</span>
                <Textarea value={inspect.note ?? ""} onChange={(event) => updateOne({ note: event.target.value || undefined })} rows={4} />
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("protoPageNotesHint")}</p>
            )}
          </label>
        ) : null}

        {tab === "style" && selection.length ? (
          <>
            {multi ? <div className="mb-2 text-xs text-muted-foreground">{t("protoMultiSelection", { count: selection.length })}</div> : null}
            {!multi && inspect ? (
              <label className="mb-2 grid gap-1">
                <span className="text-xs text-muted-foreground">{t("protoLabel")}</span>
                <Input value={inspect.label} onChange={(event) => updateOne({ label: event.target.value || inspect.type })} />
              </label>
            ) : null}
            <label className="mb-2 grid gap-1">
              <span className="text-xs text-muted-foreground">{t("protoStyleEffect")}</span>
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                value={styleTarget}
                onChange={(event) => setStyleTarget(event.target.value as StyleTarget)}
              >
                <option value="base">{t("protoStyleBase")}</option>
                {STYLE_EFFECTS.map((effect) => (
                  <option key={effect} value={effect}>{t(STYLE_EFFECT_LABEL[effect])}</option>
                ))}
              </select>
            </label>
            {previewEl ? (
              <div className="mb-3 rounded border border-border bg-muted/30 p-2" style={{ minHeight: 48 }}>
                <div className="relative mx-auto" style={{ width: Math.min(120, previewEl.w), height: Math.min(80, previewEl.h) }}>
                  <div className="absolute inset-0 overflow-hidden" style={stylePatchToInline(previewPatch)}>
                    <ElementFace el={previewEl} />
                  </div>
                </div>
              </div>
            ) : null}
            {STYLE_TAB_FIELDS.map((field) => (
              <StyleFieldEditor
                key={field.key}
                field={field}
                value={mixedStyleValue(selection, styleTarget, field.key)}
                onChange={(value) => applyStyleField(field.key, value)}
              />
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NumField label={t("protoX")} value={inspect?.x ?? 0} mixed={multi && new Set(selection.map((el) => el.x)).size > 1} onChange={(value) => updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, x: snap(value) } : el))} />
              <NumField label={t("protoY")} value={inspect?.y ?? 0} mixed={multi && new Set(selection.map((el) => el.y)).size > 1} onChange={(value) => updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, y: snap(value) } : el))} />
              <NumField label={t("protoW")} value={inspect?.w ?? 0} mixed={multi && new Set(selection.map((el) => el.w)).size > 1} onChange={(value) => updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, w: Math.max(SNAP, snap(value)) } : el))} />
              <NumField label={t("protoH")} value={inspect?.h ?? 0} mixed={multi && new Set(selection.map((el) => el.h)).size > 1} onChange={(value) => updateMany((el) => (selection.some((s) => s.id === el.id) ? { ...el, h: Math.max(SNAP, snap(value)) } : el))} />
            </div>
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
          </>
        ) : null}

        {tab === "style" && !selection.length ? (
          <>
            <div className="mb-2 text-xs text-muted-foreground">{t("protoNoSelection")}</div>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t("protoBackground")}</span>
              <Input value={canvas.background} onChange={(event) => onCanvas({ background: event.target.value || "#ffffff" })} />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NumField label={t("protoW")} value={canvas.width} onChange={(value) => onCanvas({ width: Math.max(SNAP, snap(value)) })} />
              <NumField label={t("protoH")} value={canvas.height} onChange={(value) => onCanvas({ height: Math.max(SNAP, snap(value)) })} />
            </div>
          </>
        ) : null}

        {tab === "properties" && inspect && !multi ? (
          <>
            {inspect.type === "Radio" ? (
              <div className="mb-3 space-y-2 rounded border border-border p-2">
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{t("protoRadioGroup")}</span>
                  <select
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={typeof inspect.props.group === "string" ? inspect.props.group : ""}
                    onChange={(event) => onRadioGroup(event.target.value || null)}
                  >
                    <option value="">{t("protoRadioGroupNone")}</option>
                    <option value="__create__">{t("protoRadioGroupNew")}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={inspect.props.checked === true} onChange={(event) => onRadioChecked(event.target.checked)} />
                  {t("protoPropChecked")}
                </label>
              </div>
            ) : null}
            {LIST_EDITOR_TYPES.includes(inspect.type) && listKey ? (
              <Button type="button" size="sm" variant="outline" className="mb-2" onClick={() => setListOpen(true)}>
                {t("protoEditList")}
              </Button>
            ) : null}
            {(INSPECTOR_FIELDS[inspect.type] ?? [])
              .filter((field) => !(LIST_EDITOR_TYPES.includes(inspect.type) && field.kind === "list"))
              .filter((field) => inspect.type !== "Table" || !["columns", "rows"].includes(field.key))
              .map((field) => (
                <FieldEditor key={field.key} field={field} value={inspect.props[field.key]} onChange={(value) => setProp(field.key, value)} />
              ))}
            {inspect.type === "Table" ? <InspectorTableEditor el={inspect} onChange={onReplaceElement} /> : null}
          </>
        ) : null}

        {tab === "properties" && !inspect ? (
          <>
            <div className="mb-2 text-xs text-muted-foreground">{t("protoNoSelection")}</div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label={t("protoW")} value={canvas.width} onChange={(value) => onCanvas({ width: Math.max(SNAP, snap(value)) })} />
              <NumField label={t("protoH")} value={canvas.height} onChange={(value) => onCanvas({ height: Math.max(SNAP, snap(value)) })} />
            </div>
          </>
        ) : null}

        {tab === "properties" && multi ? (
          <div className="text-xs text-muted-foreground">{t("protoPropertiesMulti")}</div>
        ) : null}
      </div>
      {inspect && listKey ? (
        <InspectorListDialog
          open={listOpen}
          title={t("protoEditList")}
          items={listItems}
          onClose={() => setListOpen(false)}
          onSave={(items) => {
            onReplaceElement({ ...inspect, props: { ...inspect.props, [listKey]: items } });
          }}
        />
      ) : null}
    </aside>
  );
}

function NumField({ label, value, onChange, mixed }: { label: string; value: number; onChange: (value: number) => void; mixed?: boolean }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input type="number" value={mixed ? "" : value} placeholder={mixed ? "—" : undefined} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function StyleFieldEditor({
  field,
  value,
  onChange,
}: {
  field: (typeof STYLE_TAB_FIELDS)[number];
  value: string | number | boolean | "mixed" | undefined;
  onChange: (value: PropValue) => void;
}) {
  const mixed = value === "mixed";
  if (field.kind === "boolean") {
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={value === true} disabled={mixed} onChange={(event) => onChange(event.target.checked)} />
        <span>{t(field.label)}</span>
      </label>
    );
  }
  if (field.kind === "number") {
    return (
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t(field.label)}</span>
        <Input type="number" value={mixed || value === undefined ? "" : String(value)} placeholder={mixed ? "—" : undefined} onChange={(event) => onChange(Number(event.target.value))} />
      </label>
    );
  }
  if (field.kind === "select") {
    return (
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t(field.label)}</span>
        <select className="h-8 rounded-md border border-input bg-transparent px-2 text-sm" value={mixed ? "" : typeof value === "string" ? value : field.options?.[0] ?? ""} onChange={(event) => onChange(event.target.value)}>
          {mixed ? <option value="">—</option> : null}
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">{t(field.label)}</span>
      <Input value={mixed ? "" : typeof value === "string" ? value : ""} placeholder={mixed ? "—" : undefined} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FieldEditor({ field, value, onChange }: { field: Field; value: PropValue | undefined; onChange: (value: PropValue) => void }) {
  if (field.kind === "boolean") {
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        <span>{t(field.label)}</span>
      </label>
    );
  }
  if (field.kind === "number") {
    return <NumField label={t(field.label)} value={typeof value === "number" ? value : 0} onChange={onChange} />;
  }
  if (field.kind === "list") {
    const lines = Array.isArray(value) ? value.join("\n") : "";
    return (
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t(field.label)}</span>
        <Textarea value={lines} onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} />
      </label>
    );
  }
  if (field.kind === "select") {
    return (
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t(field.label)}</span>
        <select className="h-8 rounded-md border border-input bg-transparent px-2 text-sm" value={typeof value === "string" ? value : field.options?.[0] ?? ""} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }
  const Tag = field.kind === "textarea" ? Textarea : Input;
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">{t(field.label)}</span>
      <Tag value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
