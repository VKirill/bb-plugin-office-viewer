import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT, type I18nKey } from "../../shared/i18n";
import { parseWireframe } from "./model";
import { PrototypePreviewPlayer } from "./preview-player";

export type WireframeHistorySnapshot = {
  id: string;
  createdAt: number;
  reason: "save" | "autosave" | "risky";
};

export function WireframeHistoryDialog({
  open,
  onOpenChange,
  stem,
  loadSnapshots,
  loadSnapshotJson,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stem: string | null;
  loadSnapshots: () => Promise<WireframeHistorySnapshot[]>;
  loadSnapshotJson: (snapshotId: string) => Promise<string>;
  onRestore: (snapshotId: string) => Promise<void>;
}) {
  const t = useT();
  const [snapshots, setSnapshots] = useState<WireframeHistorySnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewJson, setPreviewJson] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!stem) return;
    setBusy(true);
    try {
      setSnapshots(await loadSnapshots());
    } finally {
      setBusy(false);
    }
  }, [loadSnapshots, stem]);

  useEffect(() => {
    if (!open) {
      setPreviewJson(null);
      return;
    }
    void refresh();
  }, [open, refresh]);

  const formatWhen = (createdAt: number) => new Date(createdAt).toLocaleString();

  const reasonLabel = (reason: WireframeHistorySnapshot["reason"]) =>
    t(`protoHistoryReason_${reason}` as I18nKey);

  return (
    <>
      <Dialog open={open && previewJson === null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("protoHistoryTitle")}</DialogTitle>
          </DialogHeader>
          {!stem ? <p className="text-sm text-muted-foreground">{t("protoHistorySaveFirst")}</p> : null}
          {stem ? (
            <div className="max-h-72 overflow-auto">
              {snapshots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("protoHistoryEmpty")}</p>
              ) : (
                <ul className="space-y-1">
                  {snapshots.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{formatWhen(item.createdAt)}</div>
                        <div className="text-xs text-muted-foreground">{reasonLabel(item.reason)}</div>
                      </div>
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void loadSnapshotJson(item.id).then(setPreviewJson)}>
                        {t("protoHistoryOpen")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void onRestore(item.id).finally(() => {
                            setBusy(false);
                            onOpenChange(false);
                          });
                        }}
                      >
                        {t("protoHistoryRestore")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {previewJson ? (
        <PrototypePreviewPlayer doc={parseWireframe(previewJson)} onClose={() => setPreviewJson(null)} />
      ) : null}
    </>
  );
}
