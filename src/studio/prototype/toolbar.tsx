import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconTooltipButton } from "@/components/ui/icon-tooltip-button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useT } from "../../shared/i18n";
import { AutosaveLabel } from "../autosave-label";
import type { AutosaveStatus } from "../session";
import type { AlignEdge, DistributeAxis } from "./align";
import { ALIGN_ROW_ITEMS } from "./align-ui";

export type ToolbarMenu = "file" | "send" | "zoom" | "more";

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function PrototypeToolbar({
  barRef,
  menu,
  toggleMenu,
  nameDraft,
  setNameDraft,
  commitName,
  index,
  historyLength,
  undo,
  redo,
  selectedCount,
  duplicateSelected,
  removeSelected,
  nudgeLayer,
  narrow,
  applyAlign,
  applyDistribute,
  zoom,
  setZoom,
  fitZoom,
  badges,
  setBadges,
  busy,
  sendToChat,
  onNew,
  onOpen,
  onSave,
  toggleLeftPane,
  toggleRightPane,
  autosaveStatus,
  connectorToolActive = false,
  onToggleConnectorTool,
}: {
  barRef: React.RefObject<HTMLDivElement | null>;
  menu: ToolbarMenu | null;
  toggleMenu: (id: ToolbarMenu) => void;
  nameDraft: string;
  setNameDraft: (value: string) => void;
  commitName: () => void;
  index: number;
  historyLength: number;
  undo: () => void;
  redo: () => void;
  selectedCount: number;
  duplicateSelected: () => void;
  removeSelected: () => void;
  nudgeLayer: (delta: 1 | -1) => void;
  narrow: boolean;
  applyAlign: (edge: AlignEdge) => void;
  applyDistribute: (axis: DistributeAxis) => void;
  zoom: number;
  setZoom: (value: number) => void;
  fitZoom: () => void;
  badges: boolean;
  setBadges: (fn: (on: boolean) => boolean) => void;
  busy: boolean;
  sendToChat: (kind: "both" | "png" | "json") => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  toggleLeftPane: () => void;
  toggleRightPane: () => void;
  autosaveStatus: AutosaveStatus;
  connectorToolActive?: boolean;
  onToggleConnectorTool?: () => void;
}) {
  const t = useT();
  return (
    <TooltipProvider delayDuration={400}>
      <div ref={barRef} className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="relative" data-toolbar-menu>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" aria-expanded={menu === "file"} onClick={() => toggleMenu("file")}>
            {t("protoFile")}
            <Icon name="ChevronDown" className="size-3" />
          </Button>
          {menu === "file" ? (
            <div className="absolute left-0 z-30 mt-1 w-44 rounded-md border border-border bg-background p-1 shadow-md">
              <MenuItem onClick={onNew}>{t("protoNew")}</MenuItem>
              <MenuItem onClick={onOpen}>{t("protoOpen")}</MenuItem>
              <MenuItem disabled={busy} onClick={onSave}>{t("save")}</MenuItem>
            </div>
          ) : null}
        </div>
        <Input
          value={nameDraft}
          aria-label={t("protoRename")}
          className="h-8 w-32 min-w-16 max-w-40 border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input"
          onChange={(event) => setNameDraft(event.target.value.replace(/[/\\]/g, ""))}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
        <Sep />
        <ToolBtn tip={t("protoToggleLeft")} onClick={toggleLeftPane}>
          <Icon name="PanelLeft" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoToggleRight")} onClick={toggleRightPane}>
          <Icon name="PanelRight" className="size-4" />
        </ToolBtn>
        <Sep />
        {onToggleConnectorTool ? (
          <ToolBtn tip={t("protoToolConnector")} pressed={connectorToolActive} onClick={onToggleConnectorTool}>
            <Icon name="GitBranch" className="size-4" />
          </ToolBtn>
        ) : null}
        <ToolBtn tip={t("protoUndoTip")} disabled={index === 0} onClick={undo}>
          <Icon name="ArrowTurnBackward" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoRedoTip")} disabled={index >= historyLength - 1} onClick={redo}>
          <Icon name="ArrowTurnForward" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoDuplicateTip")} disabled={!selectedCount} onClick={duplicateSelected}>
          <Icon name="Copy" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoDeleteTip")} disabled={!selectedCount} onClick={removeSelected}>
          <Icon name="Trash2" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoBringForward")} disabled={!selectedCount} onClick={() => nudgeLayer(1)}>
          <Icon name="ChevronsUp" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoSendBackward")} disabled={!selectedCount} onClick={() => nudgeLayer(-1)}>
          <Icon name="ChevronsDown" className="size-4" />
        </ToolBtn>
        {narrow ? (
          <>
            <Sep />
            <div className="relative" data-toolbar-menu>
              <ToolBtn tip={t("protoMore")} pressed={menu === "more"} onClick={() => toggleMenu("more")}>
                <Icon name="MoreHorizontal" className="size-4" />
              </ToolBtn>
              {menu === "more" ? (
                <div className="absolute left-0 z-30 mt-1 w-56 rounded-md border border-border bg-background p-1 shadow-md">
                  {ALIGN_ROW_ITEMS.map((item) => {
                    const disabled = item.action === "distribute" ? selectedCount < 3 : !selectedCount;
                    const onClick = () => (item.action === "align" ? applyAlign(item.edge) : applyDistribute(item.axis));
                    const key = item.action === "align" ? item.edge : item.axis;
                    return (
                      <MenuItem key={key} disabled={disabled} onClick={onClick}>
                        <Icon name={item.icon} className="size-4 shrink-0" />
                        {t(item.labelKey)}
                      </MenuItem>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <Sep />
            {ALIGN_ROW_ITEMS.map((item) => {
              const disabled = item.action === "distribute" ? selectedCount < 3 : !selectedCount;
              const onClick = () => (item.action === "align" ? applyAlign(item.edge) : applyDistribute(item.axis));
              const key = item.action === "align" ? item.edge : item.axis;
              return (
                <IconTooltipButton
                  key={key}
                  label={t(item.labelKey)}
                  shortcut={t(item.shortcutKey)}
                  disabled={disabled}
                  className="size-8"
                  onClick={onClick}
                >
                  <Icon name={item.icon} className="size-4" />
                </IconTooltipButton>
              );
            })}
          </>
        )}
        <div className="relative" data-toolbar-menu title={t("protoZoomMenu")}>
          <Button type="button" variant="ghost" size="sm" className="h-8 min-w-14 gap-1 tabular-nums" aria-expanded={menu === "zoom"} onClick={() => toggleMenu("zoom")}>
            {Math.round(zoom * 100)}%
            <Icon name="ChevronDown" className="size-3" />
          </Button>
          {menu === "zoom" ? (
            <div className="absolute left-0 z-30 mt-1 w-36 rounded-md border border-border bg-background p-1 shadow-md">
              {ZOOM_PRESETS.map((value) => (
                <MenuItem key={value} onClick={() => setZoom(value)}>
                  {Math.round(value * 100)}%
                </MenuItem>
              ))}
              <MenuItem onClick={fitZoom}>{t("zoomFit")}</MenuItem>
            </div>
          ) : null}
        </div>
        <ToolBtn tip={t("protoBadges")} pressed={badges} onClick={() => setBadges((on) => !on)}>
          <TagGlyph />
        </ToolBtn>
        <AutosaveLabel status={autosaveStatus} />
        <div className="relative ml-auto" data-toolbar-menu>
          <Button type="button" variant="default" size="sm" className="h-8 gap-1" disabled={busy} aria-expanded={menu === "send"} onClick={() => toggleMenu("send")}>
            {t("sendToChat")}
            <Icon name="ChevronDown" className="size-3" />
          </Button>
          {menu === "send" ? (
            <div className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-border bg-background p-1 shadow-md">
              <MenuItem onClick={() => sendToChat("both")}>{t("protoSendBoth")}</MenuItem>
              <MenuItem onClick={() => sendToChat("png")}>{t("protoSendPng")}</MenuItem>
              <MenuItem onClick={() => sendToChat("json")}>{t("protoSendJson")}</MenuItem>
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

function Sep() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

function ToolBtn({ tip, disabled, pressed, onClick, children }: { tip: string; disabled?: boolean; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <IconTooltipButton label={tip} disabled={disabled} pressed={pressed} onClick={onClick} className="size-8">
      {children}
    </IconTooltipButton>
  );
}

function MenuItem({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" disabled={disabled} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-state-hover disabled:pointer-events-none disabled:opacity-50" onClick={onClick}>
      {children}
    </button>
  );
}

function TagGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
      <path d="M2.5 8.5 8.5 2.5h5v5L7.5 13.5z M11 5.5h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
