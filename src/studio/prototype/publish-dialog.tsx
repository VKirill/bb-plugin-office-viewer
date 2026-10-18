import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "../../shared/i18n";
import { PNG_EXPORT_DEVICES, PNG_EXPORT_SCALES, type PngExportScale } from "./publish";

export function PrototypePublishDialog({
  open,
  onOpenChange,
  previewUrl,
  published,
  busy,
  onPublish,
  onUnpublish,
  onCopyLink,
  onOpenLink,
  onExportPdf,
  onExportSvg,
  onExportPng,
  onImportFile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl: string | null;
  published: boolean;
  busy: boolean;
  onPublish: () => void | Promise<void>;
  onUnpublish: () => void | Promise<void>;
  onCopyLink: () => void;
  onOpenLink: () => void;
  onExportPdf: (includeNotes: boolean) => void | Promise<void>;
  onExportSvg: () => void | Promise<void>;
  onExportPng: (devices: readonly string[], scales: readonly PngExportScale[]) => void | Promise<void>;
  onImportFile: (file: File) => void | Promise<void>;
}) {
  const t = useT();
  const [includeNotes, setIncludeNotes] = useState(true);
  const [devices, setDevices] = useState<Record<string, boolean>>({ desktop: true, tablet: false, phone: false });
  const [scales, setScales] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: false });

  useEffect(() => {
    if (!open) return;
    setIncludeNotes(true);
  }, [open]);

  const selectedDevices = PNG_EXPORT_DEVICES.filter((id) => devices[id]);
  const selectedScales = PNG_EXPORT_SCALES.filter((scale) => scales[scale]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("protoPublishTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <span className="text-xs font-medium">{t("protoPublishLink")}</span>
            <div className="flex gap-2">
              <Input readOnly value={previewUrl ?? ""} className="h-9 font-mono text-xs" />
              <Button type="button" size="sm" variant="outline" disabled={!previewUrl} onClick={onCopyLink}>
                {t("protoPublishCopy")}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!previewUrl} onClick={onOpenLink}>
                {t("protoPublishOpen")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={busy} onClick={() => void onPublish()}>
                {published ? t("protoPublishUpdate") : t("protoPublishAction")}
              </Button>
              {published ? (
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void onUnpublish()}>
                  {t("protoPublishUnpublish")}
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="font-medium">{t("protoExportRasterTitle")}</p>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
              {t("protoExportPdfNotes")}
            </label>
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void onExportPdf(includeNotes)}>
              {t("protoExportPdf")}
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={busy} className="ml-2" onClick={() => void onExportSvg()}>
              {t("protoExportSvg")}
            </Button>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="font-medium">{t("protoExportPngTitle")}</p>
            <div className="flex flex-wrap gap-3">
              {PNG_EXPORT_DEVICES.map((device) => (
                <label key={device} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={devices[device]}
                    onChange={(e) => setDevices((prev) => ({ ...prev, [device]: e.target.checked }))}
                  />
                  {device === "desktop" ? t("protoDeviceDesktop") : device === "tablet" ? t("protoDeviceTablet") : t("protoDevicePhone")}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {PNG_EXPORT_SCALES.map((scale) => (
                <label key={scale} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={scales[scale]} onChange={(e) => setScales((prev) => ({ ...prev, [scale]: e.target.checked }))} />
                  {scale}x
                </label>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy || !selectedDevices.length || !selectedScales.length}
              onClick={() => void onExportPng(selectedDevices, selectedScales)}
            >
              {t("protoExportPng")}
            </Button>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="font-medium">{t("protoImportTitle")}</p>
            <Input
              type="file"
              accept=".svg,.excalidraw,.json,image/svg+xml"
              className="h-9 text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onImportFile(file);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
