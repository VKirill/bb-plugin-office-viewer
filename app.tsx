// Office Viewer — frontend: a spreadsheet file opener. BB routes
// .xlsx/.xls/.ods/.csv files here from chat links, the file picker and
// `bb thread open`. Cells can be selected, quoted into the chat and, for
// .xlsx/.xlsm/.csv/.tsv, edited and saved without touching the rest of the file.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { definePluginApp, useBbNavigate, useComposer, useRpc, type PluginFileOpenerProps } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { detectLocale, t } from "./i18n";
import { EXTENSIONS, editMode, extensionOf, findCells, parseWorkbook, type Sheet } from "./sheet";
import { cellKey, displayEdit, editorText, formatQuote, parseInput, rangeLabel, rangeTsv, staleFormulas, toCellEdit, toRange, type Edit, type Position } from "./edits";
import { Grid, type Editing, type GridHandle } from "./grid";

type Loaded = { bytes: Uint8Array; sheets: Sheet[]; hostName: string; absPath: string; sizeBytes: number; sha256: string };
type PendingEntry = { sheet: number; row: number; col: number; edit: Edit };
type SaveState = "idle" | "saving" | "conflict" | "error";

const FREEZE_KEY = "office-viewer:freeze";
const STALE_KEY = "office-viewer:stale:";
const EXTRA_ROWS = 50;
const EXTRA_COLS = 10;
const NEW_COLUMN_WIDTH = 80;
const isMac = /Mac|iPhone|iPad/i.test(globalThis.navigator?.platform ?? "");
const MOD = isMac ? "⌘" : "Ctrl+";

const pendingKey = (sheet: number, row: number, col: number) => `${sheet}:${row}:${col}`;

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

/** Formulas marked stale by an earlier save, valid while the file keeps that hash. */
function readSavedStale(absPath: string, sha256: string): Set<string> {
  try {
    const record = JSON.parse(globalThis.localStorage?.getItem(STALE_KEY + absPath) ?? "null") as { sha256: string; keys: string[] } | null;
    if (record?.sha256 === sha256) return new Set(record.keys);
    globalThis.localStorage?.removeItem(STALE_KEY + absPath);
  } catch {
    /* no storage */
  }
  return new Set();
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
  const composer = useComposer();
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
  const [anchor, setAnchor] = useState<Position | null>(null);
  const [focus, setFocus] = useState<Position | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [pending, setPending] = useState<Map<string, PendingEntry>>(() => new Map());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedStale, setSavedStale] = useState<Set<string>>(() => new Set());
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const grid = useRef<GridHandle>(null);
  const undoStack = useRef<{ key: string; prev: PendingEntry | undefined }[][]>([]);
  const editingRef = useRef<Editing | null>(null);
  editingRef.current = editing;

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
      setDoc({ bytes, sheets, hostName: result.hostName, absPath: result.absPath, sizeBytes: result.sizeBytes, sha256: result.sha256 });
      setSavedStale(readSavedStale(result.absPath, result.sha256));
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
    setAnchor(null);
    setFocus(null);
    setPending(new Map());
    undoStack.current = [];
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const base = doc?.sheets[active] ?? null;
  const mode = doc ? editMode(extensionOf(doc.absPath)) : null;
  const editable = mode !== null;

  // The active sheet as displayed: pending edits applied, room to add data.
  const sheet = useMemo<Sheet | null>(() => {
    if (!base) return null;
    let rows = base.rows;
    let cols = base.cols;
    for (const entry of pending.values()) {
      if (entry.sheet !== active) continue;
      rows = Math.max(rows, entry.row + 1);
      cols = Math.max(cols, entry.col + 1);
    }
    if (editable) {
      rows += EXTRA_ROWS;
      cols += EXTRA_COLS;
    }
    const widths = base.widths.concat(new Array(Math.max(0, cols - base.widths.length)).fill(NEW_COLUMN_WIDTH));
    return {
      ...base,
      rows,
      cols,
      widths,
      cell: (row, col) => {
        const entry = pending.get(pendingKey(active, row, col));
        return entry ? displayEdit(entry.edit, base.cell(row, col)) : base.cell(row, col);
      },
    };
  }, [base, pending, active, editable]);

  const stale = useMemo(() => {
    const keys = new Set(savedStale);
    if (doc && pending.size) {
      const changed = [...pending.values()].map((e) => ({ sheet: doc.sheets[e.sheet].name, row: e.row, col: e.col }));
      for (const key of staleFormulas(doc.sheets, changed)) keys.add(key);
    }
    return keys;
  }, [doc, pending, savedStale]);

  const matches = useMemo(() => (sheet ? findCells(sheet, appliedQuery) : []), [sheet, appliedQuery]);
  const matchSet = useMemo(() => new Set(sheet ? matches.map((m) => cellKey(sheet.cols, m.row, m.col)) : []), [sheet, matches]);
  const currentMatch = matches[matchIndex] ?? null;

  const select = useCallback((from: Position, to: Position = from) => {
    setAnchor(from);
    setFocus(to);
  }, []);

  useEffect(() => {
    setMatchIndex(0);
    if (matches[0]) {
      select(matches[0]);
      grid.current?.reveal(matches[0]);
    }
  }, [appliedQuery, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (delta: number) => {
    if (!matches.length) return;
    const next = (matchIndex + delta + matches.length) % matches.length;
    setMatchIndex(next);
    select(matches[next]);
    grid.current?.reveal(matches[next]);
  };

  const range = anchor && focus ? toRange(anchor, focus) : null;
  const single = range && range.r1 === range.r2 && range.c1 === range.c2;
  const cell = sheet && anchor ? sheet.cell(anchor.row, anchor.col) : null;

  const applyEdits = useCallback((list: { row: number; col: number; edit: Edit }[]) => {
    if (!list.length) return;
    setPending((current) => {
      const next = new Map(current);
      const batch: { key: string; prev: PendingEntry | undefined }[] = [];
      for (const { row, col, edit } of list) {
        const key = pendingKey(active, row, col);
        batch.push({ key, prev: current.get(key) });
        next.set(key, { sheet: active, row, col, edit });
      }
      undoStack.current.push(batch);
      return next;
    });
    setSaveState("idle");
  }, [active]);

  const undo = useCallback(() => {
    const batch = undoStack.current.pop();
    if (!batch) return;
    setPending((current) => {
      const next = new Map(current);
      for (const { key, prev } of batch.reverse()) {
        if (prev) next.set(key, prev);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  const startEdit = useCallback((position: Position, initial?: string) => {
    if (!sheet || !editable) return;
    select(position);
    setEditing({ row: position.row, col: position.col, draft: initial ?? editorText(sheet.cell(position.row, position.col)) });
  }, [sheet, editable, select]);

  const commitEdit = useCallback((move: [number, number] | null) => {
    const current = editingRef.current;
    if (!current || !sheet || !base || !mode) return;
    editingRef.current = null;
    setEditing(null);
    if (current.draft !== editorText(sheet.cell(current.row, current.col))) {
      applyEdits([{ row: current.row, col: current.col, edit: parseInput(current.draft, base.cell(current.row, current.col), mode) }]);
    }
    if (move) {
      const next = { row: Math.max(0, current.row + move[0]), col: Math.max(0, current.col + move[1]) };
      select(next);
      grid.current?.reveal(next);
    }
  }, [sheet, base, mode, applyEdits, select]);

  const clearRange = useCallback(() => {
    if (!sheet || !range || !editable) return;
    const list = [];
    for (let row = range.r1; row <= Math.min(range.r2, sheet.rows - 1); row++) {
      for (let col = range.c1; col <= Math.min(range.c2, sheet.cols - 1); col++) {
        if (sheet.cell(row, col)) list.push({ row, col, edit: { kind: "clear" } as Edit });
      }
    }
    applyEdits(list);
  }, [sheet, range, editable, applyEdits]);

  const copy = useCallback(() => {
    if (!sheet || !range) return;
    navigator.clipboard.writeText(rangeTsv(range, sheet.cell)).then(() => toast.success(t("copied")), (cause) => toast.error(errorText(cause)));
  }, [sheet, range]);

  const reference = () => (doc && base && range ? `${doc.absPath} · ${base.name}!${rangeLabel(range)}` : "");

  const quote = (text?: string) => {
    if (!doc || !base || !sheet || !range) return;
    const block = formatQuote({
      path: doc.absPath,
      host: doc.hostName,
      sheet: base.name,
      range: { ...range, r2: Math.min(range.r2, sheet.rows - 1), c2: Math.min(range.c2, sheet.cols - 1) },
      cellAt: sheet.cell,
      comment: text,
      more: (rows, cols) => t("more", { rows, cols }),
    });
    composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${block}\n\n`);
    composer.focus();
    toast.success(t("quoted"));
  };

  const save = useCallback(async (expected?: string) => {
    if (!doc || !pending.size || saveState === "saving") return;
    setSaveState("saving");
    setSaveError(null);
    try {
      let sha = expected ?? doc.sha256;
      const bySheet = new Map<number, PendingEntry[]>();
      for (const entry of pending.values()) bySheet.set(entry.sheet, [...(bySheet.get(entry.sheet) ?? []), entry]);
      const changed = [...pending.values()].map((e) => ({ sheet: doc.sheets[e.sheet].name, row: e.row, col: e.col }));
      const nowStale = staleFormulas(doc.sheets, changed);
      for (const [index, entries] of bySheet) {
        const result = await rpc.call("save", {
          ...request,
          expectedSha256: sha,
          sheet: { index, name: doc.sheets[index].name },
          edits: entries.map((e) => toCellEdit(e, e.edit)),
        });
        if (result.outcome === "conflict") {
          setSaveState("conflict");
          return;
        }
        sha = result.sha256;
      }
      const keys = new Set([...savedStale, ...nowStale]);
      if (keys.size) globalThis.localStorage?.setItem(STALE_KEY + doc.absPath, JSON.stringify({ sha256: sha, keys: [...keys] }));
      setPending(new Map());
      undoStack.current = [];
      setSaveState("idle");
      toast.success(t("saved"));
      await load();
    } catch (cause) {
      setSaveError(errorText(cause));
      setSaveState("error");
    }
  }, [doc, pending, saveState, rpc, request, savedStale, load]);

  const overwrite = async () => {
    try {
      const fresh = await rpc.call("open", request);
      await save(fresh.sha256);
    } catch (cause) {
      setSaveError(errorText(cause));
      setSaveState("error");
    }
  };

  const discard = () => {
    setPending(new Map());
    undoStack.current = [];
    setSaveState("idle");
  };

  const download = () => {
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([doc.bytes as BlobPart]));
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.absPath.slice(doc.absPath.lastIndexOf("/") + 1);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const toggleFreeze = () => {
    setFreeze((value) => {
      globalThis.localStorage?.setItem(FREEZE_KEY, value ? "off" : "on");
      return !value;
    });
  };

  const fileName = path.slice(path.lastIndexOf("/") + 1);
  const pendingSheets = new Set([...pending.values()].map((e) => e.sheet));

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          void save();
        }
      }}
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
        <Icon name="GridView" className="size-4 shrink-0 text-muted-foreground" />
        <div className="ml-1 flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate text-sm font-medium" title={doc?.absPath ?? path}>{fileName}</span>
          {doc ? <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{doc.hostName} · {formatSize(doc.sizeBytes)}</span> : null}
          {doc && !editable ? <span className="shrink-0 rounded border border-border px-1 text-[11px] text-muted-foreground" title={t("readOnly")}>{t("readOnlyBadge")}</span> : null}
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
        <ToolButton label={t("refresh")} onClick={() => void load()} disabled={loading || pending.size > 0}>
          <Icon name={loading ? "Spinner" : "ArrowReloadHorizontal"} className={cn("size-4", loading && "animate-spin")} />
        </ToolButton>
        <ToolButton label={t("download")} onClick={download} disabled={!doc}>
          <Icon name="Download" className="size-4" />
        </ToolButton>
      </div>

      {pending.size > 0 || saveState !== "idle" ? (
        <div role="status" className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-1 text-xs">
          {saveState === "conflict" ? (
            <>
              <Icon name="AlertTriangle" className="size-3.5 text-amber-500" />
              <span className="flex-1">{t("conflict")}</span>
              <Button variant="outline" size="sm" className="h-7" onClick={() => { discard(); void load(); }}>{t("reloadTheirs")}</Button>
              <Button size="sm" className="h-7" onClick={() => void overwrite()}>{t("overwrite")}</Button>
            </>
          ) : (
            <>
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              <span className="tabular-nums">{t("unsaved", { n: pending.size })}</span>
              {saveState === "error" ? <span className="min-w-0 flex-1 truncate text-destructive" title={saveError ?? ""}>{t("saveFailed")}: {saveError}</span> : <span className="flex-1" />}
              <Button variant="ghost" size="sm" className="h-7" onClick={undo} disabled={saveState === "saving"}>{t("undo")} <span className="text-muted-foreground">{MOD}Z</span></Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={discard} disabled={saveState === "saving"}>{t("discard")}</Button>
              <Button size="sm" className="h-7" onClick={() => void save()} disabled={saveState === "saving"}>
                {saveState === "saving" ? t("saving") : t("save")} <span className="opacity-70">{MOD}S</span>
              </Button>
            </>
          )}
        </div>
      ) : null}

      {sheet ? (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-xs" data-bb-ru-skip="">
          <span className="w-20 shrink-0 truncate font-mono text-muted-foreground">{range ? rangeLabel(range) : ""}</span>
          <span className="min-w-0 flex-1 truncate select-text" title={single ? cell?.text : undefined}>
            {single && cell?.formula ? <span className="mr-2 font-mono text-muted-foreground">{cell.formula}</span> : null}
            {single ? cell?.text : null}
          </span>
          {single && cell?.link ? (
            <ToolButton label={t("openLink")} onClick={() => navigate.openUrl(cell.link!)}><Icon name="ArrowUpRight" className="size-4" /></ToolButton>
          ) : null}
          {range ? (
            <ToolButton label={t("quote")} onClick={() => quote()}><Icon name="MessageSquarePlus" className="size-3.5" /></ToolButton>
          ) : null}
          {range ? (
            <ToolButton label={t("copyCells")} onClick={copy}><Icon name="Copy" className="size-3.5" /></ToolButton>
          ) : null}
        </div>
      ) : null}

      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!sheet}>
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
            ) : !sheet || sheet.cols === 0 ? (
              <Status>{t("emptySheet")}</Status>
            ) : (
              <Grid
                ref={grid}
                sheet={sheet}
                freeze={freeze}
                anchor={anchor}
                focus={focus}
                onSelect={select}
                matches={matchSet}
                current={currentMatch}
                isStale={(row, col) => stale.has(`${sheet.name}!${row}:${col}`)}
                isEdited={(row, col) => pending.has(pendingKey(active, row, col))}
                editable={editable}
                editing={editing}
                onStartEdit={startEdit}
                onDraft={(draft) => setEditing((current) => (current ? { ...current, draft } : current))}
                onCommitEdit={commitEdit}
                onCancelEdit={() => {
                  editingRef.current = null;
                  setEditing(null);
                }}
                onClear={clearRange}
                onCopy={copy}
                onUndo={undo}
                onOpenLink={(url) => navigate.openUrl(url)}
                hints={{ link: t("linkHint"), stale: t("staleHint") }}
              />
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-60" data-bb-ru-skip="" onCloseAutoFocus={(event) => event.preventDefault()}>
          <ContextMenuItem disabled={!range} onSelect={() => quote()}>
            <Icon name="MessageSquarePlus" className="size-4" /> {t("quote")}
          </ContextMenuItem>
          <ContextMenuItem disabled={!range} onSelect={() => { setComment(""); setCommentOpen(true); }}>
            <Icon name="MessageSquare" className="size-4" /> {t("comment")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={!range} onSelect={copy}>
            <Icon name="Copy" className="size-4" /> {t("copyCells")} <ContextMenuShortcut>{MOD}C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!range}
            onSelect={() => navigator.clipboard.writeText(reference()).then(() => toast.success(t("copied")), (cause) => toast.error(errorText(cause)))}
          >
            <Icon name="Target" className="size-4" /> {t("copyReference")}
          </ContextMenuItem>
          {single && cell?.link ? (
            <ContextMenuItem onSelect={() => navigate.openUrl(cell.link!)}>
              <Icon name="ArrowUpRight" className="size-4" /> {t("openLink")}
            </ContextMenuItem>
          ) : null}
          {editable ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem disabled={!anchor} onSelect={() => anchor && setTimeout(() => startEdit(anchor), 0)}>
                <Icon name="Edit" className="size-4" /> {t("edit")} <ContextMenuShortcut>F2</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem disabled={!range} onSelect={clearRange}>
                <Icon name="Trash2" className="size-4" /> {t("clear")} <ContextMenuShortcut>⌫</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem disabled={!undoStack.current.length} onSelect={undo}>
                <Icon name="ArrowTurnBackward" className="size-4" /> {t("undo")} <ContextMenuShortcut>{MOD}Z</ContextMenuShortcut>
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>

      {doc && doc.sheets.length ? (
        <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border pl-1 pr-3">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" role="tablist" aria-label={t("sheets")} data-bb-ru-skip="">
            {doc.sheets.map((item, index) => (
              <button
                key={`${index}:${item.name}`}
                type="button"
                role="tab"
                aria-selected={index === active}
                onClick={() => {
                  setActive(index);
                  setAnchor(null);
                  setFocus(null);
                  setEditing(null);
                }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
                  index === active && "bg-accent font-medium text-foreground",
                  item.hidden && "italic",
                )}
              >
                {pendingSheets.has(index) ? <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> : null}
                {item.name}
                {item.hidden ? <span className="text-muted-foreground">({t("hidden")})</span> : null}
              </button>
            ))}
          </div>
          {base ? <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">{t("size", { rows: base.rows, cols: base.cols })}</span> : null}
        </div>
      ) : null}

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent data-bb-ru-skip="">
          <DialogHeader>
            <DialogTitle>{t("commentTitle")}</DialogTitle>
            <DialogDescription className="font-mono">{base && range ? `${base.name}!${rangeLabel(range)}` : ""}</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={4}
            value={comment}
            placeholder={t("commentPlaceholder")}
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                quote(comment);
                setCommentOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => { quote(comment); setCommentOpen(false); }}>{t("addToChat")} <span className="opacity-70">{MOD}↵</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
