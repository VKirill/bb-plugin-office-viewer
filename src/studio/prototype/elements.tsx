import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { readIconColor, readIconSize } from "./icon-inspector";
import { ProtoIcon } from "./proto-icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import { readTable } from "./inspector-model";
import type { PropValue, WireframeElement } from "./model";
import { isFlowShape, shapePath } from "./shapes";

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
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : fallback;
}

function variantOf(value: PropValue | undefined): ButtonVariant {
  return VARIANTS.includes(value as ButtonVariant) ? (value as ButtonVariant) : "default";
}

const inert = "pointer-events-none h-full w-full";

function boxFill(fill: string, custom?: string): string {
  if (fill === "custom" && custom) return custom;
  if (fill === "light") return "color-mix(in oklab, var(--foreground) 8%, transparent)";
  if (fill === "dark") return "color-mix(in oklab, var(--foreground) 18%, transparent)";
  return "transparent";
}

function stickyBg(color: string): string {
  const map: Record<string, string> = {
    yellow: "#fef08a",
    blue: "#93c5fd",
    green: "#86efac",
    pink: "#f9a8d4",
  };
  return map[color] ?? map.yellow;
}

function markerBg(color: string): string {
  const map: Record<string, string> = { red: "#ef4444", blue: "#3b82f6", green: "#22c55e", orange: "#f97316" };
  return map[color] ?? map.red;
}

/** Looks like the real control; the canvas wrapper owns pointer events. */
export function ElementFace({ el }: { el: WireframeElement }) {
  const t = useT();
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
      const table = readTable(el);
      return (
        <table className={cn(inert, "border-collapse text-xs")}>
          <thead>
            <tr>
              {table.headers.map((header, i) => (
                <th key={i} className="border border-border bg-muted px-1 py-0.5 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.cells.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border border-border px-1 py-0.5 text-muted-foreground">
                    {cell}
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
    case "Box": {
      const radius = num(p, "radius", 0);
      const fill = text(p, "fill", "none");
      const custom = text(p, "fillColor", "");
      return (
        <div
          className={cn(inert, "flex items-center justify-center border border-foreground/70 px-2 text-center text-xs")}
          style={{ borderRadius: radius, background: boxFill(fill, custom) }}
        >
          {text(p, "text", "")}
        </div>
      );
    }
    case "Ellipse":
      return (
        <div
          className={cn(inert, "flex items-center justify-center rounded-full border border-foreground/70 px-2 text-center text-xs")}
          style={{ background: boxFill(text(p, "fill", "light")) }}
        >
          {text(p, "text", "")}
        </div>
      );
    case "Placeholder":
      return (
        <div className={cn(inert, "relative flex items-center justify-center bg-muted/40 text-xs text-muted-foreground")}>
          <div className="pointer-events-none absolute inset-0">
            <svg className="size-full" preserveAspectRatio="none">
              <line x1="0" y1="0" x2="100%" y2="100%" stroke="currentColor" strokeWidth="1" opacity="0.35" />
              <line x1="100%" y1="0" x2="0" y2="100%" stroke="currentColor" strokeWidth="1" opacity="0.35" />
            </svg>
          </div>
          {text(p, "text", "Placeholder")}
        </div>
      );
    case "Label":
      return <div className={cn(inert, "px-1 text-xs text-muted-foreground")}>{text(p, "text", "Label")}</div>;
    case "Paragraph":
      return <div className={cn(inert, "whitespace-pre-wrap px-1 text-sm leading-snug")}>{text(p, "text", "Paragraph")}</div>;
    case "Line": {
      const vertical = text(p, "orientation", "horizontal") === "vertical";
      const stroke = text(p, "stroke", "#333333");
      const dashed = p.dashed === true;
      return (
        <div className={cn(inert, "flex items-center justify-center")}>
          <div
            className={vertical ? "h-full w-0 border-l" : "h-0 w-full border-t"}
            style={{ borderColor: stroke, borderStyle: dashed ? "dashed" : "solid" }}
          />
        </div>
      );
    }
    case "DynamicPanel": {
      const states = list(p, "states", ["State 1"]);
      const active = text(p, "active", states[0] ?? "State 1");
      return (
        <div className={cn(inert, "flex flex-col border border-border bg-muted/20 p-2 text-xs")}>
          <div className="mb-1 font-medium text-muted-foreground">{active}</div>
          <div className="flex-1 rounded-sm border border-dashed border-border bg-background/60" />
        </div>
      );
    }
    case "Repeater": {
      const layout = text(p, "layout", "table");
      const columns = list(p, "columns", ["Col 1", "Col 2"]);
      const rows = Math.min(8, Math.max(1, Math.round(num(p, "rows", 3))));
      if (layout === "cards") {
        return (
          <div className={cn(inert, "grid grid-cols-2 gap-1 p-1")}>
            {Array.from({ length: Math.min(4, rows) }, (_, i) => (
              <div key={i} className="rounded border border-border bg-card p-1 text-[10px] text-muted-foreground">
                Card {i + 1}
              </div>
            ))}
          </div>
        );
      }
      return (
        <table className={cn(inert, "border-collapse text-[10px]")}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} className="border border-border bg-muted px-1 py-0.5 font-medium">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {columns.map((col) => (
                  <td key={col} className="border border-border px-1 py-0.5 text-muted-foreground">
                    {r + 1}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "HotSpot":
      return <div className={cn(inert, "border border-dashed border-primary/50 bg-primary/5")} title={text(p, "note", "")} />;
    case "InlineFrame":
      return (
        <div className={cn(inert, "flex flex-col border border-border bg-muted/30 p-2 text-xs")}>
          <div className="truncate text-muted-foreground">{text(p, "url", "https://")}</div>
          <div className="mt-1 flex-1 rounded-sm border border-dashed border-border bg-background/50" />
        </div>
      );
    case "Snapshot":
      return (
        <div className={cn(inert, "flex flex-col items-center justify-center gap-1 border border-border bg-muted/30 text-xs text-muted-foreground")}>
          <Icon name="File" className="size-5" />
          {text(p, "target", "Page")}
        </div>
      );
    case "ListBox": {
      const items = list(p, "items", ["Item"]);
      const selected = text(p, "selected", items[0] ?? "");
      return (
        <ul className={cn(inert, "overflow-hidden rounded-md border border-input text-sm")}>
          {items.map((item) => (
            <li key={item} className={cn("px-2 py-1", item === selected && "bg-muted font-medium")}>{item}</li>
          ))}
        </ul>
      );
    }
    case "SearchField":
      return (
        <div className={cn(inert, "flex items-center gap-2 rounded-md border border-input px-2 text-sm")}>
          <Icon name="Search" className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{text(p, "placeholder", "Search")}</span>
        </div>
      );
    case "DatePicker":
      return (
        <div className={cn(inert, "flex items-center justify-between rounded-md border border-input px-3 text-sm")}>
          <span className="text-muted-foreground">{text(p, "placeholder", "mm/dd/yyyy")}</span>
          <Icon name="Calendar" className="size-4 text-muted-foreground" />
        </div>
      );
    case "FileUpload":
      return (
        <div className={cn(inert, "flex items-center justify-center rounded-md border border-dashed border-input bg-muted/20 text-xs text-muted-foreground")}>
          {text(p, "text", "Choose file")}
        </div>
      );
    case "Tree":
      return (
        <ul className={cn(inert, "flex flex-col gap-0.5 overflow-hidden px-2 py-1 font-mono text-xs")}>
          {list(p, "items", ["Item"]).map((line, i) => (
            <li key={`${i}-${line}`} className="whitespace-pre text-foreground">{line}</li>
          ))}
        </ul>
      );
    case "Menu": {
      const items = list(p, "items", ["Menu"]);
      const vertical = text(p, "orientation", "horizontal") === "vertical";
      return (
        <div className={cn(inert, vertical ? "flex flex-col gap-1 border border-border p-1 text-sm" : "flex gap-2 border-b border-border px-2 text-sm")}>
          {items.map((item) => (
            <span key={item} className="text-muted-foreground">{item}</span>
          ))}
        </div>
      );
    }
    case "Breadcrumbs": {
      const items = list(p, "items", ["Home"]);
      return (
        <div className={cn(inert, "flex flex-wrap items-center gap-1 px-1 text-xs text-muted-foreground")}>
          {items.map((item, i) => (
            <span key={`${item}-${i}`}>
              {i > 0 ? " / " : ""}
              {item}
            </span>
          ))}
        </div>
      );
    }
    case "Pagination": {
      const pages = Math.min(12, Math.max(1, Math.round(num(p, "pages", 5))));
      const current = Math.min(pages, Math.max(1, Math.round(num(p, "current", 1))));
      return (
        <div className={cn(inert, "flex items-center gap-1 px-1 text-xs")}>
          {Array.from({ length: pages }, (_, i) => i + 1).map((page) => (
            <span key={page} className={cn("rounded px-1.5 py-0.5", page === current ? "bg-foreground text-background" : "text-muted-foreground")}>
              {page}
            </span>
          ))}
        </div>
      );
    }
    case "Progress": {
      const value = Math.min(100, Math.max(0, num(p, "value", 50)));
      return (
        <div className={cn(inert, "flex items-center px-1")}>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${value}%` }} />
          </div>
        </div>
      );
    }
    case "Alert": {
      const variant = text(p, "variant", "info");
      const tone =
        variant === "success"
          ? "border-green-500/40 bg-green-500/10"
          : variant === "warning"
            ? "border-amber-500/40 bg-amber-500/10"
            : variant === "error"
              ? "border-red-500/40 bg-red-500/10"
              : "border-blue-500/40 bg-blue-500/10";
      return (
        <div className={cn(inert, "flex flex-col gap-0.5 rounded-md border p-2 text-xs", tone)}>
          <div className="font-semibold">{text(p, "title", "Alert")}</div>
          <div className="text-muted-foreground">{text(p, "text", "")}</div>
        </div>
      );
    }
    case "Tooltip":
      return (
        <div className={cn(inert, "flex items-center justify-center")}>
          <span className="rounded bg-foreground px-2 py-1 text-[10px] text-background">{text(p, "text", "Tooltip")}</span>
        </div>
      );
    case "Arrow": {
      const vertical = text(p, "orientation", "horizontal") === "vertical";
      const stroke = text(p, "stroke", "#333333");
      return (
        <div className={cn(inert, "flex items-center justify-center")}>
          <svg className="size-full" viewBox="0 0 100 24" preserveAspectRatio="none">
            {vertical ? (
              <path d="M50 2 V18 M50 18 L42 12 M50 18 L58 12" fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            ) : (
              <path d="M2 12 H82 M82 12 L74 6 M82 12 L74 18" fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
        </div>
      );
    }
    case "Sticky":
      return (
        <div className={cn(inert, "p-2 text-sm shadow-sm")} style={{ background: stickyBg(text(p, "color", "yellow")) }}>
          {text(p, "text", "Note")}
        </div>
      );
    case "Marker": {
      const shape = text(p, "shape", "circle");
      const bg = markerBg(text(p, "color", "red"));
      const label = text(p, "text", "1");
      if (shape === "drop") {
        return (
          <div className={cn(inert, "relative flex items-end justify-center pb-1 text-[10px] font-semibold text-white")}>
            <svg className="absolute inset-0 size-full" viewBox="0 0 32 32">
              <path d="M16 2 C10 2 6 8 6 14 C6 22 16 30 16 30 C16 30 26 22 26 14 C26 8 22 2 16 2 Z" fill={bg} />
            </svg>
            <span className="relative z-[1] mb-1">{label}</span>
          </div>
        );
      }
      return (
        <div className={cn(inert, "flex items-center justify-center rounded-full text-[10px] font-semibold text-white")} style={{ background: bg }}>
          {label}
        </div>
      );
    }
    case "Shape": {
      const raw = text(p, "shape", "rectangle");
      const shape = isFlowShape(raw) ? raw : "rectangle";
      const d = shapePath(shape, el.w, el.h);
      return (
        <div className={cn(inert, "relative flex items-center justify-center")}>
          <svg className="absolute inset-0 size-full" viewBox={`0 0 ${el.w} ${el.h}`} preserveAspectRatio="none">
            <path d={d} fill={text(p, "fill", "#ffffff")} stroke={text(p, "stroke", "#333333")} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="relative z-[1] max-w-full px-1 text-center text-xs leading-tight">{text(p, "text", "")}</span>
        </div>
      );
    }
  }
}
