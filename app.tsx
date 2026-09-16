// Office Viewer — frontend: a read-only spreadsheet file opener. BB routes
// .xlsx/.xls/.ods/.csv files here from chat links, the file picker and
// `bb thread open`; the grid is rendered in the browser from the file's bytes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { definePluginApp, useBbNavigate, useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { detectLocale, t } from "./i18n";
import { EXTENSIONS, cellAddress, extensionOf, findCells, parseWorkbook, type Sheet } from "./sheet";
import { Grid, cellKey, type GridHandle, type Position } from "./grid";

type Loaded = { bytes: Uint8Array; sheets: Sheet[]; hostName: string; absPath: string; sizeBytes: number };

const FREEZE_KEY = "office-viewer:freeze";

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick(): void; disabled?: boolean; children: ReactNode }) {
  return (
    <span title={label} className="shrink-0"><Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" aria-label={label} onClick={onClick} disabled={disabled}>
      {children}
    </Button></span>
  );
}

function Status({ children }: { children: ReactNode }) {
  return <div role="status" className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

function SpreadsheetOpener({ path, source }: PluginFileOpenerProps) {
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();
  const request = useMemo(
    () => ({
      path,
      locale: detectLocale(),
      source: {
        kind: source.kind,
        threadId: source.threadId,
        environmentId: source.environmentId,
        projectId: source.projectId,
        hostId: source.experimental_hostId ?? null,
      },
    }),
    [path, source.kind, source.threadId, source.environmentId, source.projectId, source.experimental_hostId],
  );

  const [doc, setDoc] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [freeze, setFreeze] = useState(() => globalThis.localStorage?.getItem(FREEZE_KEY) !== "off");
  const [selected, setSelected] = useState<Position | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const grid = useRef<GridHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await rpc.call("open", request);
      const bytes = decodeBase64(result.base64);
      let sheets: Sheet[];
      try {
        sheets = parseWorkbook(bytes, extensionOf(result.absPath));
      } catch (cause) {
        throw new Error(`${t("parseFailed")}: ${errorText(cause)}`);
      }
      setDoc({ bytes, sheets, hostName: result.hostName, absPath: result.absPath, sizeBytes: result.sizeBytes });
      setActive((index) => (index < sheets.length ? index : 0));
      setError(null);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [rpc, request]);

  useEffect(() => {
    setDoc(null);
    setActive(0);
    setSelected(null);
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const sheet = doc?.sheets[active] ?? null;
  const matches = useMemo(() => (sheet ? findCells(sheet, appliedQuery) : []), [sheet, appliedQuery]);
  const matchSet = useMemo(() => new Set(sheet ? matches.map((m) => cellKey(sheet, m.row, m.col)) : []), [sheet, matches]);
  const currentMatch = matches[matchIndex] ?? null;

  const select = useCallback((position: Position) => {
    setSelected(position);
    grid.current?.reveal(position);
  }, []);

  useEffect(() => {
    setMatchIndex(0);
    if (matches[0]) select(matches[0]);
  }, [matches, select]);

  const step = (delta: number) => {
    if (!matches.length) return;
    const next = (matchIndex + delta + matches.length) % matches.length;
    setMatchIndex(next);
    select(matches[next]);
  };

  const cell = sheet && selected ? sheet.cell(selected.row, selected.col) : null;

  const copy = useCallback(() => {
    if (!cell) return;
    navigator.clipboard.writeText(cell.text).then(() => toast.success(t("copied")), (cause) => toast.error(errorText(cause)));
  }, [cell]);

  const download = () => {
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([doc.bytes as BlobPart]));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc.absPath.slice(doc.absPath.lastIndexOf("/") + 1);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const toggleFreeze = () => {
    setFreeze((value) => {
      globalThis.localStorage?.setItem(FREEZE_KEY, value ? "off" : "on");
      return !value;
    });
  };

  const fileName = path.slice(path.lastIndexOf("/") + 1);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
        <Icon name="GridView" className="size-4 shrink-0 text-muted-foreground" />
        <div className="ml-1 flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate text-sm font-medium" title={doc?.absPath ?? path}>{fileName}</span>
          {doc ? <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{doc.hostName} · {formatSize(doc.sizeBytes)}</span> : null}
        </div>
        <div className="relative flex shrink items-center">
          <Icon name="Search" className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              } else if (event.key === "Escape") {
                setQuery("");
                grid.current?.focus();
              }
            }}
            placeholder={t("search")}
            aria-label={t("search")}
            disabled={!sheet}
            className="h-7 w-44 min-w-24 pl-7 text-xs"
          />
        </div>
        {appliedQuery.trim() ? (
          <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {matches.length ? t("matchOf", { i: matchIndex + 1, n: matches.length }) : t("noMatches")}
          </span>
        ) : null}
        {matches.length > 1 ? (
          <>
            <ToolButton label={t("previousMatch")} onClick={() => step(-1)}><Icon name="ChevronUp" className="size-4" /></ToolButton>
            <ToolButton label={t("nextMatch")} onClick={() => step(1)}><Icon name="ChevronDown" className="size-4" /></ToolButton>
          </>
        ) : null}
        <ToolButton label={freeze ? t("freezeOn") : t("freezeOff")} onClick={toggleFreeze} disabled={!sheet}>
          <Icon name={freeze ? "Pin" : "PinOff"} className={cn("size-4", freeze && "text-foreground")} />
        </ToolButton>
        <ToolButton label={t("refresh")} onClick={() => void load()} disabled={loading}>
          <Icon name={loading ? "Spinner" : "ArrowReloadHorizontal"} className={cn("size-4", loading && "animate-spin")} />
        </ToolButton>
        <ToolButton label={t("download")} onClick={download} disabled={!doc}>
          <Icon name="Download" className="size-4" />
        </ToolButton>
      </div>

      {sheet ? (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-xs">
          <span className="w-16 shrink-0 font-mono text-muted-foreground">{selected ? cellAddress(selected.row, selected.col) : ""}</span>
          <span className="min-w-0 flex-1 truncate select-text" title={cell?.text}>
            {cell?.formula ? <span className="mr-2 font-mono text-muted-foreground">{cell.formula}</span> : null}
            {cell?.text}
          </span>
          {cell?.link ? (
            <ToolButton label={t("openLink")} onClick={() => navigate.openUrl(cell.link!)}><Icon name="ArrowUpRight" className="size-4" /></ToolButton>
          ) : null}
          {cell?.text ? (
            <ToolButton label={t("copy")} onClick={copy}><Icon name="Copy" className="size-3.5" /></ToolButton>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {error ? (
          <Status>
            <div className="flex max-w-md flex-col items-center gap-3">
              <div className="flex items-center gap-2 font-medium text-destructive"><Icon name="AlertTriangle" className="size-4" />{t("openFailed")}</div>
              <p className="break-words text-xs">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>{t("retry")}</Button>
            </div>
          </Status>
        ) : !doc ? (
          <Status>{t("loading")}</Status>
        ) : !sheet || sheet.rows === 0 || sheet.cols === 0 ? (
          <Status>{t("emptySheet")}</Status>
        ) : (
          <Grid ref={grid} sheet={sheet} freeze={freeze} selected={selected} onSelect={select} matches={matchSet} current={currentMatch} onCopy={copy} />
        )}
      </div>

      {doc && doc.sheets.length ? (
        <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border pl-1 pr-3">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" role="tablist" aria-label={t("sheets")}>
            {doc.sheets.map((item, index) => (
              <button
                key={`${index}:${item.name}`}
                type="button"
                role="tab"
                aria-selected={index === active}
                onClick={() => {
                  setActive(index);
                  setSelected(null);
                }}
                className={cn(
                  "shrink-0 rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
                  index === active && "bg-accent font-medium text-foreground",
                  item.hidden && "italic",
                )}
              >
                {item.name}
                {item.hidden ? <span className="ml-1 text-muted-foreground">({t("hidden")})</span> : null}
              </button>
            ))}
          </div>
          {sheet ? <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">{t("size", { rows: sheet.rows, cols: sheet.cols })}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.fileOpener({
    id: "spreadsheet",
    title: "Office Viewer",
    extensions: EXTENSIONS,
    component: SpreadsheetOpener,
  });
});
