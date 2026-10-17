import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { t } from "../../shared/i18n";

export function InspectorListDialog({
  open,
  title,
  items,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  items: string[];
  onClose: () => void;
  onSave: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState(items.join("\n"));

  useEffect(() => {
    if (open) setDraft(items.join("\n"));
  }, [open, items]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Textarea rows={10} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button
            onClick={() => {
              onSave(draft.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
              onClose();
            }}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
