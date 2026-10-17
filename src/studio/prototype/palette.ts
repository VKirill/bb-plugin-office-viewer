// Palette tiles: existing element types plus a few prop variants (no new types).
import type { I18nKey } from "../../shared/i18n";
import { CATALOG_BY_TYPE, defaultElement, type ElementType, type PaletteGroup, type PropValue, type WireframeElement } from "./model.ts";

export type PaletteTile = {
  id: string;
  type: ElementType;
  props: Record<string, PropValue>;
  labelKey: I18nKey;
};

export const PALETTE_TILES: readonly PaletteTile[] = [
  { id: "container", type: "Container", props: {}, labelKey: "protoTileContainer" },
  { id: "card", type: "Card", props: {}, labelKey: "protoTileCard" },
  { id: "modal", type: "Modal", props: {}, labelKey: "protoTileModal" },
  { id: "divider", type: "Divider", props: {}, labelKey: "protoTileDivider" },
  { id: "textfield", type: "TextField", props: {}, labelKey: "protoTileTextField" },
  { id: "textarea", type: "TextArea", props: {}, labelKey: "protoTileTextArea" },
  { id: "choice", type: "ChoicePicker", props: {}, labelKey: "protoTileChoice" },
  { id: "checkbox", type: "Checkbox", props: {}, labelKey: "protoTileCheckbox" },
  { id: "radio", type: "Radio", props: {}, labelKey: "protoTileRadio" },
  { id: "switch", type: "Switch", props: {}, labelKey: "protoTileSwitch" },
  { id: "slider", type: "Slider", props: {}, labelKey: "protoTileSlider" },
  { id: "header", type: "Header", props: {}, labelKey: "protoTileHeader" },
  { id: "heading-1", type: "Heading", props: { level: 1 }, labelKey: "protoTileHeading1" },
  { id: "heading-2", type: "Heading", props: { level: 2 }, labelKey: "protoTileHeading2" },
  { id: "heading-3", type: "Heading", props: { level: 3 }, labelKey: "protoTileHeading3" },
  { id: "text", type: "Text", props: {}, labelKey: "protoTileText" },
  { id: "button-primary", type: "Button", props: { variant: "default" }, labelKey: "protoTileButtonPrimary" },
  { id: "button-link", type: "Button", props: { variant: "link", text: "Link" }, labelKey: "protoTileButtonLink" },
  { id: "image", type: "Image", props: {}, labelKey: "protoTileImage" },
  { id: "avatar", type: "Avatar", props: {}, labelKey: "protoTileAvatar" },
  { id: "icon", type: "Icon", props: {}, labelKey: "protoTileIcon" },
  { id: "badge", type: "Badge", props: {}, labelKey: "protoTileBadge" },
  { id: "table", type: "Table", props: {}, labelKey: "protoTileTable" },
  { id: "list", type: "List", props: {}, labelKey: "protoTileList" },
  { id: "nav", type: "Nav", props: {}, labelKey: "protoTileNav" },
  { id: "tabs", type: "Tabs", props: {}, labelKey: "protoTileTabs" },
];

export const PALETTE_BY_ID: Record<string, PaletteTile> = Object.fromEntries(PALETTE_TILES.map((tile) => [tile.id, tile]));

export function tileGroup(tile: PaletteTile): PaletteGroup {
  return CATALOG_BY_TYPE[tile.type].group;
}

export function tileMatchesQuery(tile: PaletteTile, query: string, name: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return tile.type.toLowerCase().includes(q) || tile.id.toLowerCase().includes(q) || name.toLowerCase().includes(q);
}

export function elementFromTile(tile: PaletteTile, x: number, y: number, existing: readonly WireframeElement[] = []): WireframeElement {
  const el = defaultElement(tile.type, x, y, existing);
  return { ...el, props: { ...el.props, ...structuredClone(tile.props) } };
}

export function previewElement(tile: PaletteTile): WireframeElement {
  return elementFromTile(tile, 0, 0);
}
