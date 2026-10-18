import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT, type I18nKey } from "../../shared/i18n";

const STEPS: { title: I18nKey; body: I18nKey }[] = [
  { title: "protoTourLibrariesTitle", body: "protoTourLibrariesBody" },
  { title: "protoTourCanvasTitle", body: "protoTourCanvasBody" },
  { title: "protoTourInspectorTitle", body: "protoTourInspectorBody" },
  { title: "protoTourPreviewTitle", body: "protoTourPreviewBody" },
  { title: "protoTourAgentTitle", body: "protoTourAgentBody" },
];

export function PrototypeTour({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = STEPS[step]!;
  const isLast = step >= STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(current.title)}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t(current.body)}</p>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => { onDone(); onOpenChange(false); }}>{t("protoTourSkip")}</Button>
          {isLast ? (
            <Button type="button" onClick={() => { onDone(); onOpenChange(false); }}>{t("protoTourDone")}</Button>
          ) : (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>{t("protoTourNext")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
