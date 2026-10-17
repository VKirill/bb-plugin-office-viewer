import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { t } from "../../shared/i18n";
import { filterIcons, ICON_DRAG_PREFIX, iconDisplayLabel } from "./icons";
import { getHugeiconsCatalogSnapshot, preloadHugeiconsCatalog, subscribeHugeiconsCatalog } from "./hugeicons-runtime";
import { ProtoIcon } from "./proto-icon";

const COL_MIN = 72;
const ROW_H = 76;
const ICON_PREVIEW = 20;

export function IconsLibraryPanel({
  onPick,
  className,
}: {
  onPick: (iconName: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(320);
  const [width, setWidth] = useState(256);
  const scrollRef = useRef<HTMLDivElement>(null);
  const names = useSyncExternalStore(subscribeHugeiconsCatalog, getHugeiconsCatalogSnapshot, () => null);

  useEffect(() => {
    void preloadHugeiconsCatalog().catch(() => undefined);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewportH(rect.height);
      setWidth(rect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => (names ? filterIcons(names, query) : []), [names, query]);
  const cols = Math.max(1, Math.floor(width / COL_MIN));
  const totalRows = Math.ceil(filtered.length / cols) || 0;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_H) - 1);
  const visibleRows = Math.ceil(viewportH / ROW_H) + 2;
  const endRow = Math.min(totalRows, startRow + visibleRows);
  const topPad = startRow * ROW_H;
  const bottomPad = Math.max(0, (totalRows - endRow) * ROW_H);
  const sliceStart = startRow * cols;
  const sliceEnd = endRow * cols;
  const visible = filtered.slice(sliceStart, sliceEnd);

  const onScroll = useCallback(() => {
    setScrollTop(scrollRef.current?.scrollTop ?? 0);
  }, []);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="border-b border-border p-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("protoSearchIcons")}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-2" onScroll={onScroll}>
        {!names ? (
          <div className="py-8 text-center text-xs text-muted-foreground">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">{t("noMatches")}</div>
        ) : (
          <div style={{ paddingTop: topPad, paddingBottom: bottomPad }}>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {visible.map((name) => (
                <IconTile key={name} name={name} onPick={onPick} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IconTile({ name, onPick }: { name: string; onPick: (iconName: string) => void }) {
  const label = iconDisplayLabel(name);
  const previewRef = useRef<HTMLDivElement>(null);
  return (
    <button
      type="button"
      title={name}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", `${ICON_DRAG_PREFIX}${name}`);
        if (previewRef.current) event.dataTransfer.setDragImage(previewRef.current, 36, 28);
      }}
      onClick={() => onPick(name)}
      className="flex cursor-grab flex-col overflow-hidden rounded-lg px-1 pb-1 pt-1 text-left text-foreground hover:bg-state-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing active:bg-state-active"
    >
      <div ref={previewRef} className="flex h-11 items-center justify-center overflow-hidden text-muted-foreground">
        <ProtoIcon name={name} size={ICON_PREVIEW} color="foreground" />
      </div>
      <span className="line-clamp-2 min-h-7 px-0.5 text-center text-[10px] leading-3 text-muted-foreground">{label}</span>
    </button>
  );
}
