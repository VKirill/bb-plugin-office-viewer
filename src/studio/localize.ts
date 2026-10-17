import { studioT, type I18nKey } from "../shared/i18n.ts";
import type { PropValue } from "./prototype/model";

const COPY: Record<string, I18nKey> = {
  Placeholder: "protoTilePlaceholder",
  Label: "protoTileLabel",
  Paragraph: "protoTileParagraph",
  Card: "protoTileCard",
  Description: "protoDefDescription",
  Modal: "protoTileModal",
  Content: "protoDefContent",
  Heading: "protoDefHeading",
  Text: "protoTileText",
  Button: "protoTileButtonOutline",
  Link: "protoDefLink",
  Image: "protoTileImage",
  Checkbox: "protoTileCheckbox",
  Radio: "protoTileRadio",
  Switch: "protoTileSwitch",
  Alert: "protoTileAlert",
  Message: "protoDefMessage",
  Tooltip: "protoTileTooltip",
  Note: "protoNote",
  Process: "protoDefProcess",
  Header: "protoTileHeader",
  Badge: "protoTileBadge",
  "Choose file": "protoDefChooseFile",
  Search: "protoDefSearch",
  "Option 1": "protoDefOption1",
  "Option 2": "protoDefOption2",
  "Item 1": "protoDefItem1",
  "Item 2": "protoDefItem2",
  "Item 3": "protoDefItem3",
  "State 1": "protoDefState1",
  "State 2": "protoDefState2",
  "Col 1": "protoDefCol1",
  "Col 2": "protoDefCol2",
  "Tab 1": "protoDefTab1",
  "Tab 2": "protoDefTab2",
  Home: "protoDefHome",
  About: "protoDefAbout",
  Contact: "protoDefContact",
  Parent: "protoDefParent",
  "  Child A": "protoDefChildA",
  "  Child B": "protoDefChildB",
  File: "protoDefFileMenu",
  Edit: "protoDefEditMenu",
  View: "protoDefViewMenu",
  Section: "protoDefSection",
  Page: "protoDefPage",
  "Page 1": "protoPageN",
  "mm/dd/yyyy": "protoDefDatePh",
};

function localizeString(value: string): string {
  const key = COPY[value];
  if (!key) return value;
  if (key === "protoPageN") return studioT(key, { n: 1 });
  return studioT(key);
}

export function localizeProps(props: Record<string, PropValue>): Record<string, PropValue> {
  const next: Record<string, PropValue> = { ...props };
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string") next[key] = localizeString(value);
    else if (Array.isArray(value) && value.every((item) => typeof item === "string")) next[key] = value.map((item) => localizeString(item));
  }
  return next;
}
