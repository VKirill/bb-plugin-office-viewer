import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import type { WireframeElement } from "./model";
import { activePanelState, panelStates, panelViewAllStates } from "./containers";

export function PanelScopeBar({
  panel,
  state,
  onState,
  onAdd,
  onDuplicate,
  onRename,
  onDelete,
  onViewAll,
  onExit,
}: {
  panel: WireframeElement;
  state: string;
  onState: (state: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onViewAll: (on: boolean) => void;
  onExit: () => void;
}) {
  const t = useT();
  const states = panelStates(panel);
  const viewAll = panelViewAllStates(panel);
  return (
    <div data-proto-skip className="absolute inset-x-0 top-0 z-40 flex flex-wrap items-center gap-1 border-b border-border bg-background/95 px-2 py-1 shadow-sm">
      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1" onClick={onExit}>
        <Icon name="ArrowLeft" className="size-3.5" />
        {t("protoScopeExit")}
      </Button>
      <span className="text-xs text-muted-foreground">{panel.label}</span>
      <div className="flex flex-wrap gap-0.5">
        {states.map((name) => (
          <button
            key={name}
            type="button"
            className={cn("rounded px-2 py-0.5 text-xs", name === state ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-state-hover")}
            onClick={() => onState(name)}
            onDoubleClick={() => {
              const next = window.prompt(t("protoPanelRenameState"), name);
              if (next?.trim()) onRename(next.trim());
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <Button type="button" size="sm" variant="outline" className="h-7" onClick={onAdd}>{t("protoPanelAddState")}</Button>
      <Button type="button" size="sm" variant="outline" className="h-7" onClick={onDuplicate}>{t("protoPanelDuplicateState")}</Button>
      <Button type="button" size="sm" variant="outline" className="h-7" disabled={states.length <= 1} onClick={onDelete}>{t("protoPanelDeleteState")}</Button>
      <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" checked={viewAll} onChange={(event) => onViewAll(event.target.checked)} />
        {t("protoPanelViewAllStates")}
      </label>
    </div>
  );
}

export function ContainerScopeBar({ label, onExit }: { label: string; onExit: () => void }) {
  const t = useT();
  return (
    <div data-proto-skip className="absolute inset-x-0 top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-2 py-1 shadow-sm">
      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1" onClick={onExit}>
        <Icon name="ArrowLeft" className="size-3.5" />
        {t("protoScopeExit")}
      </Button>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function defaultPanelState(panel: WireframeElement): string {
  return activePanelState(panel);
}
