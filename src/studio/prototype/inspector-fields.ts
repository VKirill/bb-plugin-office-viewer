import type { I18nKey } from "../../shared/i18n.ts";
import type { ElementType, PaletteGroup } from "./model";
import { FLOW_SHAPES } from "./shapes";

export type FieldKind = "text" | "textarea" | "number" | "boolean" | "list" | "select";
export type Field = { key: string; kind: FieldKind; label: I18nKey; options?: string[] };

export const PALETTE_GROUPS: { id: PaletteGroup; label: I18nKey }[] = [
  { id: "common", label: "protoGroupCommon" },
  { id: "dynamic", label: "protoGroupDynamic" },
  { id: "forms", label: "protoGroupForms" },
  { id: "menus", label: "protoGroupMenus" },
  { id: "content", label: "protoGroupContent" },
  { id: "markup", label: "protoGroupMarkup" },
  { id: "flow", label: "protoGroupFlow" },
];

export const INSPECTOR_FIELDS: Partial<Record<ElementType, Field[]>> = {
  Header: [{ key: "text", kind: "text", label: "protoPropText" }],
  Nav: [{ key: "items", kind: "list", label: "protoPropItems" }],
  Text: [{ key: "text", kind: "textarea", label: "protoPropText" }],
  Heading: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "level", kind: "number", label: "protoPropLevel" },
  ],
  Button: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "variant", kind: "select", label: "protoPropVariant", options: ["default", "secondary", "outline", "ghost", "destructive"] },
  ],
  TextField: [
    { key: "placeholder", kind: "text", label: "protoPropPlaceholder" },
    { key: "value", kind: "text", label: "protoPropValue" },
  ],
  TextArea: [
    { key: "placeholder", kind: "text", label: "protoPropPlaceholder" },
    { key: "value", kind: "textarea", label: "protoPropValue" },
  ],
  ChoicePicker: [
    { key: "options", kind: "list", label: "protoPropOptions" },
    { key: "value", kind: "text", label: "protoPropValue" },
  ],
  Checkbox: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "checked", kind: "boolean", label: "protoPropChecked" },
  ],
  Radio: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "checked", kind: "boolean", label: "protoPropChecked" },
  ],
  Switch: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "checked", kind: "boolean", label: "protoPropChecked" },
  ],
  Slider: [
    { key: "value", kind: "number", label: "protoPropValue" },
    { key: "min", kind: "number", label: "protoPropMin" },
    { key: "max", kind: "number", label: "protoPropMax" },
  ],
  Card: [
    { key: "title", kind: "text", label: "protoPropTitle" },
    { key: "text", kind: "textarea", label: "protoPropText" },
  ],
  Image: [{ key: "alt", kind: "text", label: "protoPropAlt" }],
  Avatar: [{ key: "initials", kind: "text", label: "protoPropInitials" }],
  Badge: [{ key: "text", kind: "text", label: "protoPropText" }],
  Table: [
    { key: "columns", kind: "number", label: "protoPropColumns" },
    { key: "rows", kind: "number", label: "protoPropRows" },
  ],
  List: [{ key: "items", kind: "list", label: "protoPropItems" }],
  Tabs: [
    { key: "items", kind: "list", label: "protoPropItems" },
    { key: "active", kind: "text", label: "protoPropActive" },
  ],
  Modal: [
    { key: "title", kind: "text", label: "protoPropTitle" },
    { key: "text", kind: "textarea", label: "protoPropText" },
  ],
  Box: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "fill", kind: "select", label: "protoPropFill", options: ["none", "light", "dark", "custom"] },
    { key: "fillColor", kind: "text", label: "protoPropFillColor" },
    { key: "radius", kind: "number", label: "protoPropRadius" },
  ],
  Ellipse: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "fill", kind: "select", label: "protoPropFill", options: ["none", "light", "dark"] },
  ],
  Placeholder: [{ key: "text", kind: "text", label: "protoPropText" }],
  Label: [{ key: "text", kind: "text", label: "protoPropText" }],
  Paragraph: [{ key: "text", kind: "textarea", label: "protoPropText" }],
  Line: [
    { key: "orientation", kind: "select", label: "protoPropOrientation", options: ["horizontal", "vertical"] },
    { key: "stroke", kind: "text", label: "protoPropStroke" },
    { key: "dashed", kind: "boolean", label: "protoPropDashed" },
  ],
  DynamicPanel: [
    { key: "states", kind: "list", label: "protoPropStates" },
    { key: "active", kind: "text", label: "protoPropActive" },
  ],
  Repeater: [
    { key: "layout", kind: "select", label: "protoPropLayout", options: ["table", "cards"] },
    { key: "columns", kind: "list", label: "protoPropColumnsList" },
    { key: "rows", kind: "number", label: "protoPropRows" },
  ],
  HotSpot: [{ key: "note", kind: "text", label: "protoNote" }],
  InlineFrame: [{ key: "url", kind: "text", label: "protoPropUrl" }],
  Snapshot: [{ key: "target", kind: "text", label: "protoPropTarget" }],
  ListBox: [
    { key: "items", kind: "list", label: "protoPropItems" },
    { key: "selected", kind: "text", label: "protoPropSelected" },
  ],
  SearchField: [
    { key: "placeholder", kind: "text", label: "protoPropPlaceholder" },
    { key: "value", kind: "text", label: "protoPropValue" },
  ],
  DatePicker: [{ key: "placeholder", kind: "text", label: "protoPropPlaceholder" }],
  FileUpload: [{ key: "text", kind: "text", label: "protoPropText" }],
  Tree: [{ key: "items", kind: "list", label: "protoPropItems" }],
  Menu: [
    { key: "orientation", kind: "select", label: "protoPropOrientation", options: ["horizontal", "vertical"] },
    { key: "items", kind: "list", label: "protoPropItems" },
  ],
  Breadcrumbs: [{ key: "items", kind: "list", label: "protoPropItems" }],
  Pagination: [
    { key: "pages", kind: "number", label: "protoPropPages" },
    { key: "current", kind: "number", label: "protoPropCurrent" },
  ],
  Progress: [{ key: "value", kind: "number", label: "protoPropValue" }],
  Alert: [
    { key: "variant", kind: "select", label: "protoPropVariant", options: ["info", "success", "warning", "error"] },
    { key: "title", kind: "text", label: "protoPropTitle" },
    { key: "text", kind: "textarea", label: "protoPropText" },
  ],
  Tooltip: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "placement", kind: "select", label: "protoPropPlacement", options: ["top", "bottom", "left", "right"] },
  ],
  Arrow: [
    { key: "orientation", kind: "select", label: "protoPropOrientation", options: ["horizontal", "vertical"] },
    { key: "stroke", kind: "text", label: "protoPropStroke" },
  ],
  Sticky: [
    { key: "color", kind: "select", label: "protoPropColor", options: ["yellow", "blue", "green", "pink"] },
    { key: "text", kind: "textarea", label: "protoPropText" },
  ],
  Marker: [
    { key: "shape", kind: "select", label: "protoPropMarkerShape", options: ["circle", "drop"] },
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "color", kind: "select", label: "protoPropColor", options: ["red", "blue", "green", "orange"] },
  ],
  Shape: [
    { key: "shape", kind: "select", label: "protoPropFlowShape", options: [...FLOW_SHAPES] },
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "fill", kind: "text", label: "protoPropFillColor" },
    { key: "stroke", kind: "text", label: "protoPropStroke" },
  ],
  Connector: [
    { key: "routing", kind: "select", label: "protoPropRouting", options: ["straight", "elbow", "curved"] },
    { key: "startArrow", kind: "select", label: "protoPropStartArrow", options: ["none", "arrow", "dot"] },
    { key: "endArrow", kind: "select", label: "protoPropEndArrow", options: ["none", "arrow", "dot"] },
    { key: "dashed", kind: "boolean", label: "protoPropDashed" },
    { key: "label", kind: "text", label: "protoPropText" },
  ],
};
