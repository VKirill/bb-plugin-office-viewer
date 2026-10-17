import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { t } from "../../shared/i18n";
import { IconInspector, readIconColor, readIconSize } from "./icon-inspector";
import type { Field } from "./inspector-fields";
import { INSPECTOR_FIELDS } from "./inspector-fields";
import { iconDisplayLabel } from "./icons";
import { SNAP, snap, type PropValue, type WireframeCanvas, type WireframeElement } from "./model";

export type InspectorTab = "style" | "properties" | "notes";

export function PrototypeInspector({
  tab,
  setTab,
  inspect,
  canvas,
  pageNotes,
  onPageNotes,
  onCanvas,
  updateOne,
  setProp,
}: {
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  inspect: WireframeElement | null;
  canvas: WireframeCanvas;
  pageNotes: string;
  onPageNotes: (value: string) => void;
  onCanvas: (patch: Partial<WireframeCanvas>) => void;
  updateOne: (patch: Partial<WireframeElement>) => void;
  setProp: (key: string, value: PropValue) => void;
}) {
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
            <Textarea value={pageNotes} onChange={(event) => onPageNotes(event.target.value)} rows={8} />
            {inspect ? (
              <>
                <span className="mt-3 text-xs text-muted-foreground">{t("protoNote")}</span>
                <Textarea value={inspect.note ?? ""} onChange={(event) => updateOne({ note: event.target.value || undefined })} rows={4} />
              </>
            ) : null}
          </label>
        ) : inspect ? (
          <>
            <label className="mb-2 grid gap-1">
              <span className="text-xs text-muted-foreground">{t("protoLabel")}</span>
              <Input value={inspect.label} onChange={(event) => updateOne({ label: event.target.value || inspect.type })} />
            </label>
            {tab === "style" && inspect.type === "Icon" ? (
              <IconInspector
                name={typeof inspect.props.name === "string" ? inspect.props.name : "Star"}
                size={readIconSize(inspect.props)}
                color={readIconColor(inspect.props)}
                onName={(iconName) => updateOne({ props: { ...inspect.props, name: iconName }, label: iconDisplayLabel(iconName) })}
                onSize={(value) => updateOne({ props: { ...inspect.props, size: value }, w: value, h: value })}
                onColor={(value) => setProp("color", value)}
              />
            ) : null}
            {(INSPECTOR_FIELDS[inspect.type] ?? []).map((field) => (
              <FieldEditor key={field.key} field={field} value={inspect.props[field.key]} onChange={(value) => setProp(field.key, value)} />
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NumField label={t("protoX")} value={inspect.x} onChange={(value) => updateOne({ x: snap(value) })} />
              <NumField label={t("protoY")} value={inspect.y} onChange={(value) => updateOne({ y: snap(value) })} />
              <NumField label={t("protoW")} value={inspect.w} onChange={(value) => updateOne({ w: Math.max(SNAP, snap(value)) })} />
              <NumField label={t("protoH")} value={inspect.h} onChange={(value) => updateOne({ h: Math.max(SNAP, snap(value)) })} />
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 text-xs text-muted-foreground">{t("protoNoSelection")}</div>
            {tab === "properties" ? (
              <div className="grid grid-cols-2 gap-2">
                <NumField label={t("protoW")} value={canvas.width} onChange={(value) => onCanvas({ width: Math.max(SNAP, snap(value)) })} />
                <NumField label={t("protoH")} value={canvas.height} onChange={(value) => onCanvas({ height: Math.max(SNAP, snap(value)) })} />
              </div>
            ) : null}
            {tab === "style" ? (
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">{t("protoBackground")}</span>
                <Input value={canvas.background} onChange={(event) => onCanvas({ background: event.target.value || "#ffffff" })} />
              </label>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
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
