import { Icon } from "@/components/ui/icon";
import { IconTooltipButton } from "@/components/ui/icon-tooltip-button";
import type { ExtendedIconName } from "@/components/ui/icon-registry";
import { useT, type I18nKey } from "../../shared/i18n";
import type { AlignEdge, DistributeAxis } from "./align";

type AlignRowItem =
  | { action: "align"; edge: AlignEdge; labelKey: I18nKey; shortcutKey: I18nKey; icon: ExtendedIconName }
  | { action: "distribute"; axis: DistributeAxis; labelKey: I18nKey; shortcutKey: I18nKey; icon: ExtendedIconName };

export const ALIGN_ROW_ITEMS: AlignRowItem[] = [
  { action: "align", edge: "left", labelKey: "protoAlignLeft", shortcutKey: "protoAlignLeftShortcut", icon: "LayoutAlignLeft" },
  { action: "align", edge: "center", labelKey: "protoAlignCenter", shortcutKey: "protoAlignCenterShortcut", icon: "AlignHorizontalCenter" },
  { action: "align", edge: "right", labelKey: "protoAlignRight", shortcutKey: "protoAlignRightShortcut", icon: "LayoutAlignRight" },
  { action: "distribute", axis: "horizontal", labelKey: "protoDistributeH", shortcutKey: "protoDistributeHShortcut", icon: "DistributeHorizontalCenter" },
  { action: "align", edge: "top", labelKey: "protoAlignTop", shortcutKey: "protoAlignTopShortcut", icon: "LayoutAlignTop" },
  { action: "align", edge: "middle", labelKey: "protoAlignMiddle", shortcutKey: "protoAlignMiddleShortcut", icon: "AlignVerticalCenter" },
  { action: "align", edge: "bottom", labelKey: "protoAlignBottom", shortcutKey: "protoAlignBottomShortcut", icon: "LayoutAlignBottom" },
  { action: "distribute", axis: "vertical", labelKey: "protoDistributeV", shortcutKey: "protoDistributeVShortcut", icon: "DistributeVerticalCenter" },
];

export function alignActionIcon(kind: AlignEdge | DistributeAxis): ExtendedIconName {
  const item = ALIGN_ROW_ITEMS.find((entry) =>
    entry.action === "align" ? entry.edge === kind : entry.axis === kind,
  );
  return item?.icon ?? "LayoutAlignLeft";
}

export function InspectorAlignRow({
  selectionCount,
  applyAlign,
  applyDistribute,
}: {
  selectionCount: number;
  applyAlign: (edge: AlignEdge) => void;
  applyDistribute: (axis: DistributeAxis) => void;
}) {
  const t = useT();
  return (
    <div className="@container rounded-md border border-border p-1">
      <div className="grid grid-cols-4 gap-0.5 @[14rem]:grid-cols-8">
        {ALIGN_ROW_ITEMS.map((item) => {
          const label = t(item.labelKey);
          const shortcut = t(item.shortcutKey);
          const disabled = item.action === "distribute" ? selectionCount < 3 : selectionCount < 1;
          const onClick = () => (item.action === "align" ? applyAlign(item.edge) : applyDistribute(item.axis));
          const key = item.action === "align" ? item.edge : item.axis;
          return (
            <IconTooltipButton key={key} label={label} shortcut={shortcut} disabled={disabled} onClick={onClick}>
              <Icon name={item.icon} className="size-4" />
            </IconTooltipButton>
          );
        })}
      </div>
    </div>
  );
}
