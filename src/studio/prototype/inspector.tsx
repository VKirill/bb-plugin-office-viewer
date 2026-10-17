import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import type { Field } from "./inspector-fields";
import { INSPECTOR_FIELDS } from "./inspector-fields";
import { InspectorListDialog } from "./inspector-list-dialog";
import {
  LIST_EDITOR_TYPES,
  listPropKey,
  radioGroupOptions,
  readStringList,
  type StylePatch,
  type StyleTarget,
} from "./inspector-model";
import { InspectorStylePanel } from "./inspector-style-panel";
import type { AlignEdge, DistributeAxis } from "./align";
import { InspectorTableEditor } from "./inspector-table-editor";
import { PrototypeOverlayCloseButton } from "./shell";
import { collectDocumentColours } from "./inspector-colour";
import { RepeaterDataGrid } from "./repeater-data-grid";
import { SNAP, snap, type PropValue, type WireframeCanvas, type WireframeElement } from "./model";
import { listInstanceOverrides } from "./components";
import { normalizeRepeaterData, repeaterColumns } from "./containers";
import type { WireframeComponent, WireframePage } from "./model";
import { InspectorInteractionsPanel } from "./inspector-interactions";
import type { Interaction } from "./interactions";

export type InspectorTab = "style" | "properties" | "interactions" | "notes";

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
  applyAlign,
  applyDistribute,
  components = [],
  onInstanceOverride,
  onInstanceResetOverrides,
  onInstanceClearOverride,
  pages = [],
  onInteractionsChange,
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
  applyAlign: (edge: AlignEdge) => void;
  applyDistribute: (axis: DistributeAxis) => void;
  components?: readonly WireframeComponent[];
  onInstanceOverride?: (masterElementId: string, propKey: string, value: string) => void;
  onInstanceResetOverrides?: () => void;
  onInstanceClearOverride?: (masterElementId: string, propKey: string) => void;
  pages?: readonly WireframePage[];
  onInteractionsChange?: (interactions: Interaction[]) => void;
}) {
  const t = useT();
  const [styleTarget, setStyleTarget] = useState<StyleTarget>("base");
  const [listOpen, setListOpen] = useState(false);
  const listKey = inspect ? listPropKey(inspect.type) : null;
  const listItems = inspect && listKey ? readStringList(inspect, listKey) : [];
  const groups = useMemo(() => radioGroupOptions(elements), [elements]);
  const documentColours = useMemo(() => collectDocumentColours(canvas, elements), [canvas, elements]);
  const multi = selection.length > 1;
  const instanceComponent =
    inspect?.type === "Instance" && typeof inspect.props.componentId === "string"
      ? components.find((item) => item.id === inspect.props.componentId) ?? null
      : null;
  const instanceOverrides = inspect && instanceComponent ? listInstanceOverrides(inspect, instanceComponent) : [];

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

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-background">
      <div className="flex items-center gap-1 border-b border-border p-2">
        <div className="flex min-w-0 flex-1 gap-1">
          {(["style", "properties", "interactions", "notes"] as InspectorTab[]).map((id) => (
            <button
              key={id}
              type="button"
              className={cn("min-w-0 flex-1 rounded px-2 py-1 text-xs font-medium", tab === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setTab(id)}
            >
              {t(
                id === "style"
                  ? "protoTabStyle"
                  : id === "properties"
                    ? "protoTabProperties"
                    : id === "interactions"
                      ? "protoTabInteractions"
                      : "protoTabNotes",
              )}
            </button>
          ))}
        </div>
        <PrototypeOverlayCloseButton />
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

        {tab === "style" ? (
          <InspectorStylePanel
            inspect={inspect}
            selection={selection}
            canvas={canvas}
            documentColours={documentColours}
            multi={multi}
            styleTarget={styleTarget}
            setStyleTarget={setStyleTarget}
            applyStyleField={applyStyleField}
            updateOne={updateOne}
            updateMany={updateMany}
            setProp={setProp}
            onCanvas={onCanvas}
            applyAlign={applyAlign}
            applyDistribute={applyDistribute}
          />
        ) : null}

        {tab === "interactions" && inspect && !multi && onInteractionsChange ? (
          <InspectorInteractionsPanel
            inspect={inspect}
            pages={pages}
            elements={elements}
            onChange={onInteractionsChange}
          />
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
            {inspect.type === "Instance" && instanceComponent && instanceOverrides.length ? (
              <div className="mb-3 grid gap-2 border-b border-border pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{t("protoInstanceOverrides")}</span>
                  {onInstanceResetOverrides ? (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onInstanceResetOverrides}>
                      {t("protoInstanceResetOverrides")}
                    </Button>
                  ) : null}
                </div>
                {instanceOverrides.map((row) => {
                  const overridden = row.value !== row.masterValue;
                  return (
                    <label key={`${row.elementId}:${row.propKey}`} className="grid gap-1">
                      <span className="text-[11px] text-muted-foreground">{row.elementLabel} · {row.propKey}</span>
                      <div className="flex gap-1">
                        <Input
                          value={row.value}
                          onChange={(event) => onInstanceOverride?.(row.elementId, row.propKey, event.target.value)}
                        />
                        {overridden && onInstanceClearOverride ? (
                          <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => onInstanceClearOverride(row.elementId, row.propKey)}>
                            {t("protoInstanceResetOne")}
                          </Button>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : null}
            {inspect.type === "Table" ? <InspectorTableEditor el={inspect} onChange={onReplaceElement} /> : null}
            {inspect.type === "Repeater" ? (
              <div className="mt-3 space-y-2">
                <RepeaterDataGrid
                  repeater={inspect}
                  onUpdate={({ columns, data }) => {
                    const cols = columns ?? repeaterColumns(inspect);
                    onReplaceElement({
                      ...inspect,
                      props: { ...inspect.props, columns: cols, data: normalizeRepeaterData(cols, data), rows: data.length },
                    });
                  }}
                />
              </div>
            ) : null}
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

function FieldEditor({ field, value, onChange }: { field: Field; value: PropValue | undefined; onChange: (value: PropValue) => void }) {
  const t = useT();
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
