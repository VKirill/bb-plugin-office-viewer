import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { readIconColor, readIconSize } from "./icon-inspector";
import { ProtoIcon } from "./proto-icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { t } from "../../shared/i18n";
import type { PropValue, WireframeElement } from "./model";

const VARIANTS = ["default", "secondary", "outline", "ghost", "destructive"] as const;
type ButtonVariant = (typeof VARIANTS)[number];

function text(props: Record<string, PropValue>, key: string, fallback: string): string {
  const value = props[key];
  return typeof value === "string" ? value : fallback;
}

function num(props: Record<string, PropValue>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function flag(props: Record<string, PropValue>, key: string): boolean {
  return props[key] === true;
}

function list(props: Record<string, PropValue>, key: string, fallback: string[]): string[] {
  const value = props[key];
  return Array.isArray(value) ? value : fallback;
}

function variantOf(value: PropValue | undefined): ButtonVariant {
  return VARIANTS.includes(value as ButtonVariant) ? (value as ButtonVariant) : "default";
}

const inert = "pointer-events-none h-full w-full";

/** Looks like the real control; the canvas wrapper owns pointer events. */
export function ElementFace({ el }: { el: WireframeElement }) {
  const p = el.props;
  switch (el.type) {
    case "Header":
      return <div className={cn(inert, "flex items-center bg-foreground px-4 text-sm font-semibold text-background")}>{text(p, "text", "Header")}</div>;
    case "Nav":
      return (
        <div className={cn(inert, "flex items-center gap-3 border-b border-border bg-card px-3 text-sm")}>
          {list(p, "items", ["Home"]).map((item) => (
            <span key={item} className="text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      );
    case "Text":
      return <div className={cn(inert, "px-1 text-sm text-foreground")}>{text(p, "text", "Text")}</div>;
    case "Heading": {
      const level = Math.min(3, Math.max(1, Math.round(num(p, "level", 1))));
      const size = level === 1 ? "text-2xl" : level === 2 ? "text-xl" : "text-lg";
      return <div className={cn(inert, size, "px-1 font-semibold")}>{text(p, "text", "Heading")}</div>;
    }
    case "Button":
      return (
        <Button variant={variantOf(p.variant)} className={inert} tabIndex={-1}>
          {text(p, "text", "Button")}
        </Button>
      );
    case "TextField":
      return <Input readOnly tabIndex={-1} className={inert} placeholder={text(p, "placeholder", "")} value={text(p, "value", "")} />;
    case "TextArea":
      return <Textarea readOnly tabIndex={-1} className={cn(inert, "resize-none")} placeholder={text(p, "placeholder", "")} value={text(p, "value", "")} />;
    case "ChoicePicker":
      return (
        <div className={cn(inert, "flex items-center justify-between rounded-md border border-input px-3 text-sm")}>
          <span>{text(p, "value", list(p, "options", ["Option"])[0] ?? "")}</span>
          <span className="text-muted-foreground">▾</span>
        </div>
      );
    case "Checkbox":
      return (
        <label className={cn(inert, "flex items-center gap-2 text-sm")}>
          <span className={cn("flex size-4 items-center justify-center rounded-sm border border-input", flag(p, "checked") && "bg-foreground text-background")}>
            {flag(p, "checked") ? "✓" : ""}
          </span>
          {text(p, "text", "Checkbox")}
        </label>
      );
    case "Radio":
      return (
        <label className={cn(inert, "flex items-center gap-2 text-sm")}>
          <span className={cn("flex size-4 items-center justify-center rounded-full border border-input", flag(p, "checked") && "border-foreground")}>
            {flag(p, "checked") ? <span className="size-2 rounded-full bg-foreground" /> : null}
          </span>
          {text(p, "text", "Radio")}
        </label>
      );
    case "Switch":
      return (
        <label className={cn(inert, "flex items-center gap-2 text-sm")}>
          <span className={cn("relative h-4 w-7 rounded-full", flag(p, "checked") ? "bg-foreground" : "bg-muted")}>
            <span className={cn("absolute top-0.5 size-3 rounded-full bg-background", flag(p, "checked") ? "right-0.5" : "left-0.5")} />
          </span>
          {text(p, "text", "Switch")}
        </label>
      );
    case "Slider": {
      const min = num(p, "min", 0);
      const max = Math.max(min + 1, num(p, "max", 100));
      const value = Math.min(max, Math.max(min, num(p, "value", 50)));
      const pct = ((value - min) / (max - min)) * 100;
      return (
        <div className={cn(inert, "flex items-center px-1")}>
          <div className="relative h-1 w-full rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background" style={{ left: `${pct}%` }} />
          </div>
        </div>
      );
    }
    case "Card":
      return (
        <Card className={cn(inert, "flex flex-col gap-1 p-3")}>
          <div className="text-sm font-semibold">{text(p, "title", "Card")}</div>
          <div className="text-xs text-muted-foreground">{text(p, "text", "")}</div>
        </Card>
      );
    case "Image":
      return (
        <div className={cn(inert, "flex flex-col items-center justify-center gap-1 bg-muted text-xs text-muted-foreground")}>
          <Icon name="File" className="size-5" />
          {text(p, "alt", "Image")}
        </div>
      );
    case "Avatar":
      return <div className={cn(inert, "flex items-center justify-center rounded-full bg-secondary text-xs font-semibold")}>{text(p, "initials", "AB")}</div>;
    case "Icon": {
      const iconName = text(p, "name", "Star");
      const size = readIconSize(p, 24);
      const color = readIconColor(p);
      return (
        <div className={cn(inert, "flex items-center justify-center")}>
          <ProtoIcon name={iconName} size={size} color={color} />
        </div>
      );
    }
    case "Badge":
      return <span className={cn(inert, "inline-flex items-center justify-center rounded-full bg-secondary px-2 text-xs")}>{text(p, "text", "Badge")}</span>;
    case "Table": {
      const cols = Math.min(12, Math.max(1, Math.round(num(p, "columns", 3))));
      const rows = Math.min(20, Math.max(1, Math.round(num(p, "rows", 3))));
      return (
        <table className={cn(inert, "border-collapse text-xs")}>
          <thead>
            <tr>
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="border border-border bg-muted px-1 py-0.5 font-medium">
                  {t("protoCol", { n: i + 1 })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="border border-border px-1 py-0.5 text-muted-foreground">
                    {r + 1},{c + 1}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "List":
      return (
        <ul className={cn(inert, "flex list-disc flex-col gap-1 overflow-hidden px-5 py-2 text-sm")}>
          {list(p, "items", ["Item"]).map((item, i) => (
            <li key={`${i}-${item}`}>{item}</li>
          ))}
        </ul>
      );
    case "Tabs": {
      const items = list(p, "items", ["Tab"]);
      const active = text(p, "active", items[0] ?? "");
      return (
        <div className={cn(inert, "flex border-b border-border px-1")}>
          {items.map((item) => (
            <span key={item} className={cn("px-2 py-1 text-sm", item === active ? "border-b-2 border-foreground font-medium" : "text-muted-foreground")}>
              {item}
            </span>
          ))}
        </div>
      );
    }
    case "Modal":
      return (
        <Card className={cn(inert, "flex flex-col gap-2 p-3 shadow-md")}>
          <div className="text-sm font-semibold">{text(p, "title", "Modal")}</div>
          <div className="text-xs text-muted-foreground">{text(p, "text", "")}</div>
          <div className="mt-auto flex justify-end">
            <Button size="sm" className="pointer-events-none h-7" tabIndex={-1}>
              {t("protoOk")}
            </Button>
          </div>
        </Card>
      );
    case "Divider":
      return <div className={cn(inert, "flex items-center")}><div className="h-px w-full bg-border" /></div>;
    case "Container":
      return <div className={cn(inert, "border border-dashed border-border bg-muted/20")} />;
  }
}
