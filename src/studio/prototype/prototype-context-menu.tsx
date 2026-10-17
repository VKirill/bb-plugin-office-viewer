import { useMemo } from "react";
import { AnchoredMenu } from "@/components/ui/anchored-menu";
import { useT, type I18nKey } from "../../shared/i18n";
import {
  buildMenuItems,
  formatMenuShortcut,
  MENU_SHORTCUT_TEMPLATES,
  type MenuActionId,
  type MenuBuildContext,
  type MenuTarget,
} from "./menus";

const MENU_LABEL_KEYS: Record<MenuActionId, I18nKey> = {
  cut: "protoCtxCut",
  copy: "protoCtxCopy",
  paste: "protoCtxPaste",
  duplicate: "protoCtxDuplicate",
  delete: "protoCtxDelete",
  group: "protoCtxGroup",
  ungroup: "protoCtxUngroup",
  lock: "protoCtxLock",
  unlock: "protoCtxUnlock",
  hide: "protoCtxHide",
  show: "protoCtxShow",
  bringToFront: "protoCtxBringToFront",
  bringForward: "protoCtxBringForward",
  sendBackward: "protoCtxSendBackward",
  sendToBack: "protoCtxSendToBack",
  rename: "protoCtxRename",
  duplicatePage: "protoCtxDuplicatePage",
  deletePage: "protoCtxDeletePage",
  addPage: "protoAddPage",
  closeTab: "protoCtxCloseTab",
  insertPalette: "protoCtxInsert",
  insertTemplate: "protoCtxInsertTemplate",
  insertIcon: "protoCtxInsertIcon",
  selectAll: "protoCtxSelectAll",
  components: "protoCtxComponents",
};

export function PrototypeContextMenu({
  open,
  x,
  y,
  target,
  context,
  onAction,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  target: MenuTarget | null;
  context: MenuBuildContext;
  onAction: (action: MenuActionId, target: MenuTarget) => void;
  onClose: () => void;
}) {
  const t = useT();
  const mod = t("protoModKey");

  const items = useMemo(() => {
    if (!target) return [];
    return buildMenuItems(target, context).map((item) => ({
      id: item.id,
      label: t(MENU_LABEL_KEYS[item.id]),
      shortcut: MENU_SHORTCUT_TEMPLATES[item.id]
        ? formatMenuShortcut(MENU_SHORTCUT_TEMPLATES[item.id]!, mod)
        : undefined,
      disabled: item.disabled,
      separatorBefore: item.separatorBefore,
    }));
  }, [target, context, t, mod]);

  return (
    <AnchoredMenu
      open={open}
      x={x}
      y={y}
      items={items}
      ariaLabel={t("protoContextMenu")}
      onSelect={(id) => {
        if (target) onAction(id as MenuActionId, target);
      }}
      onClose={onClose}
    />
  );
}
