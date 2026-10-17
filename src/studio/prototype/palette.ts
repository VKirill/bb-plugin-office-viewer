// Palette tiles: element types, prop variants, and flow shapes.
import type { I18nKey } from "../../shared/i18n";
import { CATALOG_BY_TYPE, defaultElement, type ElementType, type PaletteGroup, type PropValue, type WireframeElement } from "./model.ts";
import { FLOW_SHAPES, type FlowShape } from "./shapes.ts";

export type PaletteTile = {
  id: string;
  type: ElementType;
  props: Record<string, PropValue>;
  labelKey: I18nKey;
  pictogram: string;
  labelParams?: Record<string, string | number>;
};

function flowLabel(shape: FlowShape): string {
  return shape.replace(/-/g, " ");
}

const FLOW_TILES: readonly PaletteTile[] = FLOW_SHAPES.map((shape) => ({
  id: `flow-${shape}`,
  type: "Shape",
  props: { shape, text: flowLabel(shape) },
  labelKey: "protoTileFlowShape",
  pictogram: `flow-${shape}`,
  labelParams: { shape: flowLabel(shape) },
}));

export const PALETTE_TILES: readonly PaletteTile[] = [
  { id: "box-1", type: "Box", props: { fill: "none", border: true, radius: 0 }, labelKey: "protoTileBox1", pictogram: "box-1" },
  { id: "box-2", type: "Box", props: { fill: "light", border: true, radius: 4 }, labelKey: "protoTileBox2", pictogram: "box-2" },
  { id: "box-3", type: "Box", props: { fill: "dark", border: true, radius: 8 }, labelKey: "protoTileBox3", pictogram: "box-3" },
  { id: "ellipse", type: "Ellipse", props: {}, labelKey: "protoTileEllipse", pictogram: "ellipse" },
  { id: "placeholder", type: "Placeholder", props: {}, labelKey: "protoTilePlaceholder", pictogram: "placeholder" },
  { id: "label", type: "Label", props: {}, labelKey: "protoTileLabel", pictogram: "label" },
  { id: "paragraph", type: "Paragraph", props: {}, labelKey: "protoTileParagraph", pictogram: "paragraph" },
  { id: "line-h", type: "Line", props: { orientation: "horizontal" }, labelKey: "protoTileLineH", pictogram: "line-h" },
  { id: "line-v", type: "Line", props: { orientation: "vertical" }, labelKey: "protoTileLineV", pictogram: "line-v" },
  { id: "container", type: "Container", props: {}, labelKey: "protoTileContainer", pictogram: "container" },
  { id: "card", type: "Card", props: {}, labelKey: "protoTileCard", pictogram: "card" },
  { id: "modal", type: "Modal", props: {}, labelKey: "protoTileModal", pictogram: "modal" },
  { id: "divider", type: "Divider", props: {}, labelKey: "protoTileDivider", pictogram: "divider" },
  { id: "heading-1", type: "Heading", props: { level: 1 }, labelKey: "protoTileHeading1", pictogram: "heading-1" },
  { id: "heading-2", type: "Heading", props: { level: 2 }, labelKey: "protoTileHeading2", pictogram: "heading-2" },
  { id: "heading-3", type: "Heading", props: { level: 3 }, labelKey: "protoTileHeading3", pictogram: "heading-3" },
  { id: "text", type: "Text", props: {}, labelKey: "protoTileText", pictogram: "text" },
  { id: "button-outline", type: "Button", props: { variant: "outline", text: "Button" }, labelKey: "protoTileButtonOutline", pictogram: "button-outline" },
  { id: "button-primary", type: "Button", props: { variant: "default" }, labelKey: "protoTileButtonPrimary", pictogram: "button-primary" },
  { id: "button-link", type: "Button", props: { variant: "link", text: "Link" }, labelKey: "protoTileButtonLink", pictogram: "button-link" },
  { id: "image", type: "Image", props: {}, labelKey: "protoTileImage", pictogram: "image" },
  { id: "dynamic-panel", type: "DynamicPanel", props: {}, labelKey: "protoTileDynamicPanel", pictogram: "dynamic-panel" },
  { id: "repeater-table", type: "Repeater", props: { layout: "table" }, labelKey: "protoTileRepeaterTable", pictogram: "repeater-table" },
  { id: "repeater-cards", type: "Repeater", props: { layout: "cards" }, labelKey: "protoTileRepeaterCards", pictogram: "repeater-cards" },
  { id: "hotspot", type: "HotSpot", props: {}, labelKey: "protoTileHotSpot", pictogram: "hotspot" },
  { id: "inline-frame", type: "InlineFrame", props: {}, labelKey: "protoTileInlineFrame", pictogram: "inline-frame" },
  { id: "snapshot", type: "Snapshot", props: {}, labelKey: "protoTileSnapshot", pictogram: "snapshot" },
  { id: "textfield", type: "TextField", props: {}, labelKey: "protoTileTextField", pictogram: "textfield" },
  { id: "textarea", type: "TextArea", props: {}, labelKey: "protoTileTextArea", pictogram: "textarea" },
  { id: "choice", type: "ChoicePicker", props: {}, labelKey: "protoTileChoice", pictogram: "choice" },
  { id: "checkbox", type: "Checkbox", props: {}, labelKey: "protoTileCheckbox", pictogram: "checkbox" },
  { id: "radio", type: "Radio", props: {}, labelKey: "protoTileRadio", pictogram: "radio" },
  { id: "switch", type: "Switch", props: {}, labelKey: "protoTileSwitch", pictogram: "switch" },
  { id: "slider", type: "Slider", props: {}, labelKey: "protoTileSlider", pictogram: "slider" },
  { id: "listbox", type: "ListBox", props: {}, labelKey: "protoTileListBox", pictogram: "listbox" },
  { id: "search-field", type: "SearchField", props: {}, labelKey: "protoTileSearchField", pictogram: "search-field" },
  { id: "date-picker", type: "DatePicker", props: {}, labelKey: "protoTileDatePicker", pictogram: "date-picker" },
  { id: "file-upload", type: "FileUpload", props: {}, labelKey: "protoTileFileUpload", pictogram: "file-upload" },
  { id: "nav", type: "Nav", props: {}, labelKey: "protoTileNav", pictogram: "nav" },
  { id: "tabs", type: "Tabs", props: {}, labelKey: "protoTileTabs", pictogram: "tabs" },
  { id: "list", type: "List", props: {}, labelKey: "protoTileList", pictogram: "list" },
  { id: "table", type: "Table", props: {}, labelKey: "protoTileTable", pictogram: "table" },
  { id: "tree", type: "Tree", props: {}, labelKey: "protoTileTree", pictogram: "tree" },
  { id: "menu-h", type: "Menu", props: { orientation: "horizontal" }, labelKey: "protoTileMenuH", pictogram: "menu-h" },
  { id: "menu-v", type: "Menu", props: { orientation: "vertical" }, labelKey: "protoTileMenuV", pictogram: "menu-v" },
  { id: "breadcrumbs", type: "Breadcrumbs", props: {}, labelKey: "protoTileBreadcrumbs", pictogram: "breadcrumbs" },
  { id: "pagination", type: "Pagination", props: {}, labelKey: "protoTilePagination", pictogram: "pagination" },
  { id: "header", type: "Header", props: {}, labelKey: "protoTileHeader", pictogram: "header" },
  { id: "avatar", type: "Avatar", props: {}, labelKey: "protoTileAvatar", pictogram: "avatar" },
  { id: "icon", type: "Icon", props: {}, labelKey: "protoTileIcon", pictogram: "icon" },
  { id: "badge", type: "Badge", props: {}, labelKey: "protoTileBadge", pictogram: "badge" },
  { id: "progress", type: "Progress", props: {}, labelKey: "protoTileProgress", pictogram: "progress" },
  { id: "alert", type: "Alert", props: {}, labelKey: "protoTileAlert", pictogram: "alert" },
  { id: "tooltip", type: "Tooltip", props: {}, labelKey: "protoTileTooltip", pictogram: "tooltip" },
  { id: "arrow-h", type: "Arrow", props: { orientation: "horizontal" }, labelKey: "protoTileArrowH", pictogram: "arrow-h" },
  { id: "arrow-v", type: "Arrow", props: { orientation: "vertical" }, labelKey: "protoTileArrowV", pictogram: "arrow-v" },
  { id: "sticky-1", type: "Sticky", props: { color: "yellow" }, labelKey: "protoTileSticky1", pictogram: "sticky-1" },
  { id: "sticky-2", type: "Sticky", props: { color: "blue" }, labelKey: "protoTileSticky2", pictogram: "sticky-2" },
  { id: "sticky-3", type: "Sticky", props: { color: "green" }, labelKey: "protoTileSticky3", pictogram: "sticky-3" },
  { id: "sticky-4", type: "Sticky", props: { color: "pink" }, labelKey: "protoTileSticky4", pictogram: "sticky-4" },
  { id: "marker-circle", type: "Marker", props: { shape: "circle" }, labelKey: "protoTileMarkerCircle", pictogram: "marker-circle" },
  { id: "marker-drop", type: "Marker", props: { shape: "drop" }, labelKey: "protoTileMarkerDrop", pictogram: "marker-drop" },
  ...FLOW_TILES,
];

export const PALETTE_BY_ID: Record<string, PaletteTile> = Object.fromEntries(PALETTE_TILES.map((tile) => [tile.id, tile]));

export { hasPictogram, PICTOGRAM_IDS, type PictogramId } from "./pictograms-ids.ts";

export function tileGroup(tile: PaletteTile): PaletteGroup {
  return CATALOG_BY_TYPE[tile.type].group;
}

export function tileMatchesQuery(tile: PaletteTile, query: string, name: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const shape = typeof tile.props.shape === "string" ? tile.props.shape : "";
  return (
    tile.type.toLowerCase().includes(q) ||
    tile.id.toLowerCase().includes(q) ||
    name.toLowerCase().includes(q) ||
    shape.toLowerCase().includes(q)
  );
}

export function elementFromTile(tile: PaletteTile, x: number, y: number, existing: readonly WireframeElement[] = []): WireframeElement {
  let el = defaultElement(tile.type, x, y, existing);
  el = { ...el, props: { ...el.props, ...structuredClone(tile.props) } };
  if (el.type === "Line" && el.props.orientation === "vertical") el = { ...el, w: 8, h: 160 };
  if (el.type === "Arrow" && el.props.orientation === "vertical") el = { ...el, w: 24, h: 120 };
  if (el.type === "Menu" && el.props.orientation === "vertical") el = { ...el, w: 140, h: 160 };
  return el;
}

export function previewElement(tile: PaletteTile): WireframeElement {
  return elementFromTile(tile, 0, 0);
}
