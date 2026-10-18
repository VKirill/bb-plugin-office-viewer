import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import { rankCommandPaletteItems, type CommandPaletteItem } from "./styles";

export function PrototypeCommandPalette({
  open,
  onOpenChange,
  items,
  onRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandPaletteItem[];
  onRun: (item: CommandPaletteItem) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const ranked = useMemo(() => rankCommandPaletteItems(query, items).slice(0, 24), [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-popover p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          value={query}
          placeholder={t("protoCommandPalettePlaceholder")}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onOpenChange(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(ranked.length - 1, i + 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
              return;
            }
            if (e.key === "Enter" && ranked[active]) {
              e.preventDefault();
              onRun(ranked[active]!);
              onOpenChange(false);
            }
          }}
        />
        <ul className="mt-2 max-h-72 overflow-auto">
          {ranked.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={cn("flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-state-hover", index === active && "bg-muted")}
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  onRun(item);
                  onOpenChange(false);
                }}
              >
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.shortcut ?? item.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
