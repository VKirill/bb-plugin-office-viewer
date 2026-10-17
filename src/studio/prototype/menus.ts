import type { WireframeElement } from "./model.ts";

export type MenuActionId =
  | "cut"
  | "copy"
  | "paste"
  | "duplicate"
  | "delete"
  | "group"
  | "ungroup"
  | "lock"
  | "unlock"
  | "hide"
  | "show"
  | "bringToFront"
  | "bringForward"
  | "sendBackward"
  | "sendToBack"
  | "rename"
  | "duplicatePage"
  | "deletePage"
  | "addPage"
  | "closeTab"
  | "insertPalette"
  | "insertTemplate"
  | "insertIcon"
  | "selectAll"
  | "components"
  | "createComponent"
  | "editComponent"
  | "detachInstance"
  | "deleteComponent";

export type MenuTarget =
  | { kind: "canvasElement"; elementId: string }
  | { kind: "canvasEmpty" }
  | { kind: "outlineLayer"; elementId: string }
  | { kind: "page"; pageId: string }
  | { kind: "pageTab"; pageId: string }
  | { kind: "paletteTile"; tileId: string }
  | { kind: "templateTile"; templateId: string }
  | { kind: "iconTile"; iconName: string }
  | { kind: "componentTile"; componentId: string };

export type ZOrderOp = "bringToFront" | "bringForward" | "sendBackward" | "sendToBack";

export type MenuItemModel = {
  id: MenuActionId;
  disabled?: boolean;
  separatorBefore?: boolean;
};

export type MenuBuildContext = {
  selectedElementIds: readonly string[];
  targetElementId?: string;
  canPaste: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  selectionLocked: boolean;
  selectionHidden: boolean;
  pageCount: number;
  canDeletePage: boolean;
  componentsFeatureEnabled?: boolean;
  canCreateComponent?: boolean;
  canEditComponent?: boolean;
  canDetachInstance?: boolean;
};

export function formatMenuShortcut(template: string, modKey: string): string {
  return template.replace(/\{mod\}/g, modKey).replace(/\{shift\}/g, "⇧");
}

export const MENU_SHORTCUT_TEMPLATES: Partial<Record<MenuActionId, string>> = {
  cut: "{mod}X",
  copy: "{mod}C",
  paste: "{mod}V",
  duplicate: "{mod}D",
  group: "{mod}G",
  ungroup: "{mod}⇧G",
  lock: "{mod}L",
  hide: "{mod}H",
  show: "{mod}⇧H",
  bringForward: "{mod}]",
  sendBackward: "{mod}[",
  bringToFront: "{mod}⇧]",
  sendToBack: "{mod}⇧[",
  delete: "⌫",
  selectAll: "{mod}A",
  rename: "F2",
};

function layerOrderItems(): MenuItemModel[] {
  return [
    { id: "bringToFront" },
    { id: "bringForward" },
    { id: "sendBackward" },
    { id: "sendToBack", separatorBefore: false },
  ];
}

function clipboardItems(ctx: MenuBuildContext, includeCut: boolean): MenuItemModel[] {
  const items: MenuItemModel[] = [];
  if (includeCut) items.push({ id: "cut" });
  items.push({ id: "copy" });
  items.push({ id: "paste", disabled: !ctx.canPaste });
  items.push({ id: "duplicate" });
  return items;
}

function elementStackItems(ctx: MenuBuildContext): MenuItemModel[] {
  return [
    ...layerOrderItems().map((item, index) => ({ ...item, separatorBefore: index === 0 })),
    { id: "group", disabled: !ctx.canGroup, separatorBefore: true },
    { id: "ungroup", disabled: !ctx.canUngroup },
    { id: ctx.selectionLocked ? "unlock" : "lock", separatorBefore: true },
    { id: ctx.selectionHidden ? "show" : "hide" },
    { id: "rename", separatorBefore: true },
    { id: "delete" },
  ];
}

export function buildMenuItems(target: MenuTarget, ctx: MenuBuildContext): MenuItemModel[] {
  switch (target.kind) {
    case "outlineLayer":
      return [
        ...layerOrderItems().map((item, index) => ({ ...item, separatorBefore: index === 0 })),
        { id: "group", disabled: !ctx.canGroup, separatorBefore: true },
        { id: "ungroup", disabled: !ctx.canUngroup },
        { id: ctx.selectionLocked ? "unlock" : "lock", separatorBefore: true },
        { id: ctx.selectionHidden ? "show" : "hide" },
        { id: "rename", separatorBefore: true },
        { id: "delete" },
      ];
    case "canvasElement":
      return [
        ...clipboardItems(ctx, true),
        { id: "createComponent", disabled: ctx.canCreateComponent !== true, separatorBefore: true },
        { id: "editComponent", disabled: ctx.canEditComponent !== true },
        { id: "detachInstance", disabled: ctx.canDetachInstance !== true },
        ...elementStackItems(ctx).map((item, index) => (index === 0 ? { ...item, separatorBefore: true } : item)),
      ];
    case "canvasEmpty":
      return [
        { id: "paste", disabled: !ctx.canPaste },
        { id: "selectAll" },
        { id: "addPage", separatorBefore: true },
        { id: "components", disabled: ctx.componentsFeatureEnabled !== true },
      ];
    case "page":
      return [
        { id: "rename" },
        { id: "duplicatePage" },
        { id: "deletePage", disabled: !ctx.canDeletePage },
        { id: "addPage", separatorBefore: true },
      ];
    case "pageTab":
      return [
        { id: "rename" },
        { id: "duplicatePage" },
        { id: "closeTab", disabled: ctx.pageCount <= 1 },
        { id: "deletePage", disabled: !ctx.canDeletePage, separatorBefore: true },
      ];
    case "paletteTile":
      return [{ id: "insertPalette" }];
    case "templateTile":
      return [{ id: "insertTemplate" }];
    case "iconTile":
      return [{ id: "insertIcon" }];
    case "componentTile":
      return [
        { id: "editComponent" },
        { id: "deleteComponent", separatorBefore: true },
      ];
  }
}

export function nudgeZOrder(
  elements: readonly WireframeElement[],
  selectedIds: readonly string[],
  delta: 1 | -1,
): WireframeElement[] {
  if (!selectedIds.length) return [...elements];
  const next = [...elements];
  const ids = new Set(selectedIds);
  const indexes = next.map((el, i) => (ids.has(el.id) ? i : -1)).filter((i) => i >= 0);
  const walk = delta === 1 ? [...indexes].reverse() : indexes;
  for (const i of walk) {
    const j = i + delta;
    if (j < 0 || j >= next.length || ids.has(next[j]!.id)) continue;
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

export function applyZOrder(
  elements: readonly WireframeElement[],
  selectedIds: readonly string[],
  op: ZOrderOp,
): WireframeElement[] {
  if (!selectedIds.length) return [...elements];
  const ids = new Set(selectedIds);
  const picked = elements.filter((el) => ids.has(el.id));
  const rest = elements.filter((el) => !ids.has(el.id));
  if (!picked.length) return [...elements];

  switch (op) {
    case "bringForward":
      return nudgeZOrder(elements, selectedIds, 1);
    case "sendBackward":
      return nudgeZOrder(elements, selectedIds, -1);
    case "bringToFront":
      return [...rest, ...picked];
    case "sendToBack":
      return [...picked, ...rest];
  }
}

export function zOrderOpFromAction(action: MenuActionId): ZOrderOp | null {
  if (action === "bringToFront") return "bringToFront";
  if (action === "bringForward") return "bringForward";
  if (action === "sendBackward") return "sendBackward";
  if (action === "sendToBack") return "sendToBack";
  return null;
}
