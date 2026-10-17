import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "../../shared/i18n";

export function ProtoShortcutsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const rows: Array<{ keys: string; text: string }> = [
    { keys: "R O L T F", text: t("protoShortcutDrawTools") },
    { keys: "V", text: t("protoShortcutSelectTool") },
    { keys: "Esc", text: t("protoShortcutEsc") },
    { keys: "Shift", text: t("protoShortcutShift") },
    { keys: "Alt", text: t("protoShortcutAlt") },
    { keys: "Space", text: t("protoShortcutSpace") },
    { keys: "{mod}", text: t("protoShortcutMeta") },
    { keys: "?", text: t("protoShortcutHelp") },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("protoShortcutsTitle")}</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.keys} className="flex gap-3">
              <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{row.keys.replace("{mod}", t("protoModKey"))}</span>
              <span>{row.text}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
