import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";

export function UndoStepsPanel({
  open,
  onOpenChange,
  labels,
  activeIndex,
  onJump,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: string[];
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("protoUndoHistoryTitle")}</DialogTitle>
        </DialogHeader>
        <ol className="max-h-80 space-y-0.5 overflow-auto text-sm">
          {labels.map((label, index) => (
            <li key={`${index}-${label}`}>
              <button
                type="button"
                className={cn("w-full rounded px-2 py-1 text-left hover:bg-state-hover", index === activeIndex && "bg-muted font-medium")}
                onClick={() => {
                  onJump(index);
                  onOpenChange(false);
                }}
              >
                {label}
              </button>
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
      </DialogContent>
    </Dialog>
  );
}
