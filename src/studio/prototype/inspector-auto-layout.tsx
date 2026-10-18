import { Button } from "@/components/ui/button";
import { useT } from "../../shared/i18n";
import {
  isAutoLayoutStack,
  readChildSizing,
  readStackLayout,
  type ChildSizing,
  type StackAlign,
  type StackDirection,
  type StackJustify,
  type StackSizing,
  writeChildSizing,
  writeStackLayout,
} from "./layout";
import type { WireframeElement } from "./model";

export function InspectorAutoLayoutPanel({
  inspect,
  selection,
  onUpdate,
  onUpdateChild,
}: {
  inspect: WireframeElement | null;
  selection: WireframeElement[];
  onUpdate: (el: WireframeElement) => void;
  onUpdateChild: (el: WireframeElement) => void;
}) {
  const t = useT();
  if (inspect && isAutoLayoutStack(inspect)) {
    const layout = readStackLayout(inspect);
    const patchLayout = (patch: Partial<ReturnType<typeof readStackLayout>>) => onUpdate(writeStackLayout(inspect, patch));
    return (
      <div className="space-y-3 border-t border-border pt-3">
        <div className="text-xs font-medium">{t("protoAutoLayoutTitle")}</div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t("protoAutoLayoutDirection")}</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2"
            value={layout.direction}
            onChange={(event) => patchLayout({ direction: event.target.value as StackDirection })}
          >
            <option value="vertical">{t("protoAutoLayoutVertical")}</option>
            <option value="horizontal">{t("protoAutoLayoutHorizontal")}</option>
            <option value="wrap">{t("protoAutoLayoutWrap")}</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("protoAutoLayoutGap")}</span>
            <input
              type="number"
              className="h-8 rounded-md border border-input px-2"
              value={layout.gap}
              onChange={(event) => patchLayout({ gap: Number(event.target.value) })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("protoAutoLayoutPadding")}</span>
            <input
              type="number"
              className="h-8 rounded-md border border-input px-2"
              value={layout.padding[0]}
              onChange={(event) => {
                const v = Number(event.target.value);
                patchLayout({ padding: [v, v, v, v] });
              }}
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t("protoAutoLayoutAlign")}</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2"
            value={layout.align}
            onChange={(event) => patchLayout({ align: event.target.value as StackAlign })}
          >
            <option value="start">{t("protoAlignLeft")}</option>
            <option value="center">{t("protoAlignCenter")}</option>
            <option value="end">{t("protoAlignRight")}</option>
            <option value="stretch">{t("protoAutoLayoutStretch")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t("protoAutoLayoutJustify")}</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2"
            value={layout.justify}
            onChange={(event) => patchLayout({ justify: event.target.value as StackJustify })}
          >
            <option value="start">{t("protoAlignLeft")}</option>
            <option value="center">{t("protoAlignCenter")}</option>
            <option value="end">{t("protoAlignRight")}</option>
            <option value="space-between">{t("protoAutoLayoutSpaceBetween")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t("protoAutoLayoutStackSizing")}</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2"
            value={layout.sizing}
            onChange={(event) => patchLayout({ sizing: event.target.value as StackSizing })}
          >
            <option value="hug">{t("protoAutoLayoutHug")}</option>
            <option value="fixed">{t("protoAutoLayoutFixed")}</option>
            <option value="fill">{t("protoAutoLayoutFill")}</option>
          </select>
        </label>
      </div>
    );
  }
  if (selection.length === 1 && !isAutoLayoutStack(selection[0]!)) {
    const el = selection[0]!;
    const sizing = readChildSizing(el);
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <div className="text-xs font-medium">{t("protoAutoLayoutChildSizing")}</div>
        <select
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={sizing}
          onChange={(event) => onUpdateChild(writeChildSizing(el, event.target.value as ChildSizing))}
        >
          <option value="fixed">{t("protoAutoLayoutFixed")}</option>
          <option value="hug">{t("protoAutoLayoutHug")}</option>
          <option value="fill">{t("protoAutoLayoutFill")}</option>
        </select>
      </div>
    );
  }
  return null;
}

export function AutoLayoutWrapButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <Button type="button" size="sm" variant="outline" className="h-8" disabled={disabled} onClick={onClick}>
      {t("protoAutoLayoutWrap")}
    </Button>
  );
}
