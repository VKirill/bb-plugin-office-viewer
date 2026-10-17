import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "../../shared/i18n";
import type { PropValue } from "./model";
import { PROTO_ICON_SIZES, isProtoIconCustomColor } from "./icons";
import { IconsLibraryPanel } from "./icons-library";
import { ProtoIcon } from "./proto-icon";

export function IconInspector({
  name,
  size,
  color,
  onName,
  onSize,
  onColor,
}: {
  name: string;
  size: number;
  color: string;
  onName: (value: string) => void;
  onSize: (value: number) => void;
  onColor: (value: string) => void;
}) {
  const t = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
  const themeColor = isProtoIconCustomColor(color) ? "custom" : color;
  const customHex = isProtoIconCustomColor(color) ? color : "#000000";

  return (
    <div className="grid gap-2">
      <div className="text-xs text-muted-foreground">{t("protoPropName")}</div>
      <div className="flex items-center gap-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
          <ProtoIcon name={name} size={24} color={color} />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setPickerOpen(true)}>
          {t("protoIconChange")}
        </Button>
      </div>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t("protoIconSize")}</span>
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          value={size}
          onChange={(event) => onSize(Number(event.target.value))}
        >
          {PROTO_ICON_SIZES.map((value) => (
            <option key={value} value={value}>
              {value}px
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t("protoIconColor")}</span>
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          value={themeColor}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "custom") onColor(customHex);
            else onColor(next);
          }}
        >
          <option value="foreground">{t("protoIconColorForeground")}</option>
          <option value="muted">{t("protoIconColorMuted")}</option>
          <option value="primary">{t("protoIconColorPrimary")}</option>
          <option value="custom">{t("protoIconColorCustom")}</option>
        </select>
      </label>
      {themeColor === "custom" ? (
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("paintCustomColor")}</span>
          <Input value={customHex} onChange={(event) => onColor(event.target.value)} />
        </label>
      ) : null}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="flex max-h-[min(640px,90vh)] flex-col gap-2 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("protoPaletteIcons")}</DialogTitle>
          </DialogHeader>
          <IconsLibraryPanel
            className="min-h-[360px]"
            onPick={(iconName) => {
              onName(iconName);
              setPickerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function readIconSize(props: Record<string, PropValue>, fallback = 24): number {
  const value = props.size;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readIconColor(props: Record<string, PropValue>): string {
  const value = props.color;
  return typeof value === "string" && value.length > 0 ? value : "foreground";
}
