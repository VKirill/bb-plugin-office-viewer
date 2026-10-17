import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "../../shared/i18n";
import { IconsLibraryPanel } from "./icons-library";
import { PALETTE_GROUPS } from "./inspector-fields";
import { tileGroup, tileMatchesQuery, type PaletteTile } from "./palette";
import { Pictogram } from "./pictograms";
import { PrototypeOverlayCloseButton } from "./shell";
import { TemplateTileButton } from "./template-tile";
import { FORM_TEMPLATES, INTERFACE_TEMPLATES, filterTemplates } from "./templates";
import {
  LEFT_PANE_DIVIDER_SIZE,
  adjustSplitByKeyboard,
  readLeftPaneSplit,
  resolveLeftPaneHeights,
  toggleLibrariesCollapsed,
  togglePagesCollapsed,
  topRatioFromHeight,
  writeLeftPaneSplit,
  type LeftPaneSplitState,
  type SplitDividerKey,
} from "./pane-split";
import type { PaletteGroup, WireframeElement, WireframePage } from "./model";

export type PaletteLibraryView = "elements" | "templates" | "icons";

export type LeftTopTab = "pages" | "outline";

export function PrototypeLeftPane({
  topTab,
  setTopTab,
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onRenamePage,
  onReorderPages,
  elements,
  selected,
  onSelectElement,
  onToggleHidden,
  onToggleLocked,
  onReorderElements,
  onRenameElement,
  paletteView,
  setPaletteView,
  query,
  setQuery,
  collapsed,
  setCollapsed,
  filteredTiles,
  onAddTile,
  onAddTemplate,
  onAddIcon,
}: {
  topTab: LeftTopTab;
  setTopTab: (tab: LeftTopTab) => void;
  pages: WireframePage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onRenamePage: (id: string, name: string) => void;
  onReorderPages: (from: number, to: number) => void;
  elements: WireframeElement[];
  selected: string[];
  onSelectElement: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onReorderElements: (from: number, to: number) => void;
  onRenameElement: (id: string, label: string) => void;
  paletteView: PaletteLibraryView;
  setPaletteView: (view: PaletteLibraryView) => void;
  query: string;
  setQuery: (value: string) => void;
  collapsed: Partial<Record<PaletteGroup, boolean>>;
  setCollapsed: (fn: (was: Partial<Record<PaletteGroup, boolean>>) => Partial<Record<PaletteGroup, boolean>>) => void;
  filteredTiles: readonly PaletteTile[];
  onAddTile: (tile: PaletteTile) => void;
  onAddTemplate: (templateId: string) => void;
  onAddIcon: (name: string) => void;
}) {
  const [pageEdit, setPageEdit] = useState<string | null>(null);
  const [pageDraft, setPageDraft] = useState("");
  const [elEdit, setElEdit] = useState<string | null>(null);
  const [elDraft, setElDraft] = useState("");
  const dragPage = useRef<number | null>(null);
  const dragEl = useRef<number | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneHeight, setPaneHeight] = useState(480);
  const [split, setSplit] = useState<LeftPaneSplitState>(() => readLeftPaneSplit());
  const dragSplitRef = useRef<{ startY: number; startTop: number } | null>(null);

  useEffect(() => {
    writeLeftPaneSplit(split);
  }, [split]);

  useEffect(() => {
    const node = paneRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setPaneHeight(rect.height);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => resolveLeftPaneHeights(paneHeight, split), [paneHeight, split]);

  const onDividerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (split.pagesCollapsed || split.librariesCollapsed) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragSplitRef.current = { startY: event.clientY, startTop: layout.top };
    },
    [layout.top, split.librariesCollapsed, split.pagesCollapsed],
  );

  const onDividerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragSplitRef.current;
      if (!drag) return;
      const nextTop = drag.startTop + (event.clientY - drag.startY);
      setSplit((was) => ({ ...was, topRatio: topRatioFromHeight(paneHeight, nextTop, was) }));
    },
    [paneHeight],
  );

  const onDividerPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragSplitRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onDividerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const key = event.key as SplitDividerKey;
      if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "Home" && key !== "End") return;
      event.preventDefault();
      setSplit((was) => adjustSplitByKeyboard(paneHeight, was, key));
    },
    [paneHeight],
  );

  const outline = [...elements].reverse();
  const filteredFormTemplates = useMemo(
    () => filterTemplates(FORM_TEMPLATES, query, (template) => t(template.labelKey)),
    [query],
  );
  const filteredInterfaceTemplates = useMemo(
    () => filterTemplates(INTERFACE_TEMPLATES, query, (template) => t(template.labelKey)),
    [query],
  );

  return (
    <div ref={paneRef} className="flex h-full min-h-0 w-full flex-col bg-background">
      <section className="flex min-h-0 shrink-0 flex-col overflow-hidden" style={{ height: layout.top }}>
        <div className="flex items-center gap-1 p-2">
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-state-hover hover:text-foreground"
            aria-label={t("protoPaneCollapsePages")}
            aria-expanded={!split.pagesCollapsed}
            onClick={() => setSplit((was) => togglePagesCollapsed(was))}
          >
            <Icon name="ChevronDown" className={cn("size-3.5", split.pagesCollapsed && "-rotate-90")} />
          </button>
          <div className="flex min-w-0 flex-1 gap-1">
            {(["pages", "outline"] as LeftTopTab[]).map((id) => (
              <button key={id} type="button" className={cn("min-w-0 flex-1 rounded px-2 py-1 text-xs font-medium", topTab === id ? "bg-muted" : "text-muted-foreground")} onClick={() => setTopTab(id)}>
                {t(id === "pages" ? "protoTabPages" : "protoTabOutline")}
              </button>
            ))}
          </div>
          <PrototypeOverlayCloseButton />
        </div>
        {split.pagesCollapsed ? null : (
        <div className="min-h-0 flex-1 overflow-auto p-2 text-sm">
          {topTab === "pages" ? (
            <ul className="space-y-0.5">
              {pages.map((page, index) => (
                <li
                  key={page.id}
                  draggable
                  onDragStart={() => { dragPage.current = index; }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragPage.current === null || dragPage.current === index) return;
                    onReorderPages(dragPage.current, index);
                    dragPage.current = null;
                  }}
                  className={cn("flex items-center gap-1 rounded px-1 py-0.5", page.id === activePageId && "bg-muted")}
                >
                  <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onSelectPage(page.id)} onDoubleClick={() => { setPageEdit(page.id); setPageDraft(page.name); }}>
                    {pageEdit === page.id ? (
                      <Input
                        autoFocus
                        className="h-7"
                        value={pageDraft}
                        onChange={(event) => setPageDraft(event.target.value)}
                        onBlur={() => { onRenamePage(page.id, pageDraft.trim() || page.name); setPageEdit(null); }}
                        onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }}
                      />
                    ) : (
                      page.name
                    )}
                  </button>
                  <button type="button" className="text-muted-foreground hover:text-foreground" title={t("protoDuplicate")} onClick={() => onDuplicatePage(page.id)}>
                    <Icon name="Copy" className="size-3.5" />
                  </button>
                  {pages.length > 1 ? (
                    <button type="button" className="text-muted-foreground hover:text-foreground" title={t("protoDelete")} onClick={() => onDeletePage(page.id)}>
                      <Icon name="Trash2" className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-0.5">
              {outline.map((el, index) => {
                const realIndex = elements.length - 1 - index;
                return (
                  <li
                    key={el.id}
                    draggable
                    onDragStart={() => { dragEl.current = realIndex; }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragEl.current === null) return;
                      onReorderElements(dragEl.current, realIndex);
                      dragEl.current = null;
                    }}
                    className={cn("flex items-center gap-1 rounded px-1 py-0.5", selected.includes(el.id) && "bg-muted")}
                  >
                    <button type="button" className="min-w-0 flex-1 truncate text-left text-xs" onClick={() => onSelectElement(el.id)} onDoubleClick={() => { setElEdit(el.id); setElDraft(el.label); }}>
                      {elEdit === el.id ? (
                        <Input autoFocus className="h-7" value={elDraft} onChange={(event) => setElDraft(event.target.value)} onBlur={() => { onRenameElement(el.id, elDraft.trim() || el.label); setElEdit(null); }} />
                      ) : (
                        <>{el.type} · {el.label}</>
                      )}
                    </button>
                    <button type="button" className={cn("text-muted-foreground", el.hidden && "text-primary")} onClick={() => onToggleHidden(el.id)} aria-label={t("protoToggleHidden")}>
                      <Icon name={el.hidden ? "EyeOff" : "Eye"} className="size-3.5" />
                    </button>
                    <button type="button" className={cn("text-muted-foreground", el.locked && "text-primary")} onClick={() => onToggleLocked(el.id)} aria-label={t("protoToggleLock")}>
                      <Icon name={el.locked ? "Lock" : "SquareUnlock02"} className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )}
        {!split.pagesCollapsed && topTab === "pages" ? (
          <div className="p-2 pt-0">
            <button type="button" className="w-full rounded border border-border px-2 py-1 text-xs hover:bg-state-hover" onClick={onAddPage}>{t("protoAddPage")}</button>
          </div>
        ) : null}
      </section>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={t("protoPaneSplitDivider")}
        aria-valuenow={layout.top}
        aria-valuemin={80}
        aria-valuemax={Math.max(80, paneHeight - LEFT_PANE_DIVIDER_SIZE - 80)}
        className="group shrink-0 cursor-row-resize touch-none outline-none focus-visible:ring-1 focus-visible:ring-ring"
        style={{ height: LEFT_PANE_DIVIDER_SIZE }}
        onPointerDown={onDividerPointerDown}
        onPointerMove={onDividerPointerMove}
        onPointerUp={onDividerPointerUp}
        onPointerCancel={onDividerPointerUp}
        onDoubleClick={() => setSplit((was) => togglePagesCollapsed(was))}
        onKeyDown={onDividerKeyDown}
      >
        <div className="mx-2 h-px bg-border transition-colors group-hover:bg-muted-foreground/50 group-focus-visible:bg-muted-foreground/50" />
      </div>
      <section className="flex min-h-0 flex-col overflow-hidden" style={{ height: layout.bottom }}>
        <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-state-hover hover:text-foreground"
            aria-label={t("protoPaneCollapseLibraries")}
            aria-expanded={!split.librariesCollapsed}
            onClick={() => setSplit((was) => toggleLibrariesCollapsed(was))}
          >
            <Icon name="ChevronDown" className={cn("size-3.5", split.librariesCollapsed && "-rotate-90")} />
          </button>
          <span className="min-w-0 flex-1">{t("protoLibraries")}</span>
        </div>
        {split.librariesCollapsed ? null : (
        <div className="min-h-0 flex flex-1 flex-col p-2 pt-0">
          <div className="mb-2 flex gap-1 rounded-md border border-border p-0.5">
            <button type="button" className={cn("flex-1 rounded px-1 py-1 text-[11px] font-medium", paletteView === "elements" ? "bg-muted" : "text-muted-foreground")} onClick={() => setPaletteView("elements")}>{t("protoPalette")}</button>
            <button type="button" className={cn("flex-1 rounded px-1 py-1 text-[11px] font-medium", paletteView === "templates" ? "bg-muted" : "text-muted-foreground")} onClick={() => setPaletteView("templates")}>{t("protoPaletteTemplates")}</button>
            <button type="button" className={cn("flex-1 rounded px-1 py-1 text-[11px] font-medium", paletteView === "icons" ? "bg-muted" : "text-muted-foreground")} onClick={() => setPaletteView("icons")}>{t("protoPaletteIcons")}</button>
          </div>
          {paletteView === "elements" ? <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("protoSearch")} className="mb-2 h-8" /> : null}
          {paletteView === "templates" ? <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("protoSearchTemplates")} className="mb-2 h-8" /> : null}
        {paletteView === "icons" ? (
          <IconsLibraryPanel className="min-h-0 flex-1" onPick={onAddIcon} />
        ) : paletteView === "templates" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-muted-foreground">{t("protoTemplateGroupForms")}</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1">
                {filteredFormTemplates.map((template) => (
                  <TemplateTileButton key={template.id} template={template} label={t(template.labelKey)} onAdd={() => onAddTemplate(template.id)} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">{t("protoTemplateGroupInterface")}</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1">
                {filteredInterfaceTemplates.map((template) => (
                  <TemplateTileButton key={template.id} template={template} label={t(template.labelKey)} onAdd={() => onAddTemplate(template.id)} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {PALETTE_GROUPS.map((group) => {
              const items = filteredTiles.filter((tile) => tileGroup(tile) === group.id);
              if (!items.length) return null;
              const open = query.trim() ? true : !collapsed[group.id];
              return (
                <div key={group.id} className="mb-3">
                  <button type="button" className="mb-1 flex w-full items-center gap-1 text-left text-xs font-medium text-muted-foreground" onClick={() => setCollapsed((was) => ({ ...was, [group.id]: !was[group.id] }))}>
                    <Icon name="ChevronDown" className={cn("size-3", !open && "-rotate-90")} />
                    {t(group.label)}
                  </button>
                  {open ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1">
                      {items.map((tile) => (
                        <PaletteTileButton key={tile.id} tile={tile} label={t(tile.labelKey, tile.labelParams ?? {})} onAdd={() => onAddTile(tile)} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        </div>
        )}
      </section>
    </div>
  );
}

function PaletteTileButton({ tile, onAdd, label }: { tile: PaletteTile; onAdd: () => void; label: string }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const boxW = 40;
  const boxH = 40;
  return (
    <button
      type="button"
      title={tile.type}
      draggable
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData("text/plain", tile.id);
        if (previewRef.current) event.dataTransfer.setDragImage(previewRef.current, boxW / 2, boxH / 2);
      }}
      onClick={onAdd}
      className="flex cursor-grab flex-col rounded-lg px-1 pb-1 pt-1 hover:bg-state-hover"
    >
      <div ref={previewRef} className="flex h-11 items-center justify-center text-foreground">
        <Pictogram id={tile.pictogram} className="size-10" />
      </div>
      <span className="min-h-7 whitespace-normal text-balance text-center text-[10px] leading-3 text-muted-foreground">{label}</span>
    </button>
  );
}
