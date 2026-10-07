// Office Viewer — frontend: a spreadsheet file opener. BB routes
// .xlsx/.xls/.ods/.csv files here from chat links, the file picker and
// `bb thread open`. The workbook runs in the IronCalc engine: formulas
// recalculate as you type, and saving writes back only the edited cells.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
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
import { EXTENSIONS, cellAddress, editMode, extensionOf, findCells, parseWorkbook, type Cell, type Sheet } from "./sheet";
import { cellKey, editorText, formatQuote, parseTsv, rangeLabel, rangeTsv, toRange, type Position, type Range } from "./edits";
import { ENGINE_VERSION, applyInput, buildWorkbook, editsForSave, engineCell, initEngine, selectionStats, type Workbook } from "./engine";
import { canPoint, colorKey, insertReference, isFormula, referenceColors, referenceSpans, referenceText, type PointSpan } from "./formula";
import { FormulaInput, type FormulaInputHandle } from "./formula-input";
import { Grid, type GridHandle } from "./grid";
import { MEDIA_EXTENSIONS, MediaOpener } from "./media";
import { DocumentOpener, WORD_EXTENSIONS } from "./document";
import { PDF_EXTENSIONS, PdfOpener } from "./pdf";

type Loaded = { bytes: Uint8Array; hostName: string; absPath: string; sizeBytes: number; sha256: string };
type SaveState = "idle" | "saving" | "conflict" | "error";
type Editing = {
  sheet: number;
  row: number;
  col: number;
  draft: string;
  caret: number;
  /** Text span of the reference inserted by the last click or arrow in Point mode. */
  point: PointSpan | null;
  pointer: { anchor: Position; focus: Position } | null;
  /** Started by typing over the cell: arrows commit, like Excel's Enter mode. */
  typed: boolean;
  target: "cell" | "bar";
};
type ClipboardState = { sheet: number; range: Range; text: string; cut: boolean; clip: ReturnType<Workbook["model"]["copyToClipboard"]> };

const FREEZE_KEY = "office-viewer:freeze";
const EXTRA_ROWS = 50;
const EXTRA_COLS = 10;
const NEW_COLUMN_WIDTH = 80;
const MAX_PASTE = 50_000;
const MAX_BYTES = 30 * 1024 * 1024;
const isMac = /Mac|iPhone|iPad/i.test(globalThis.navigator?.platform ?? "");
const MOD = isMac ? "⌘" : "Ctrl+";

let engineReady: Promise<void> | null = null;

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The engine module, fetched from the server once and then served from the browser cache. */
async function engineBytes(fetchModule: () => Promise<Uint8Array>): Promise<Uint8Array> {
  const key = `https://office-viewer.invalid/ironcalc-${ENGINE_VERSION}.wasm`;
  let cache: Cache | null = null;
  try {
    cache = await caches.open("office-viewer");
    const hit = await cache.match(key);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch {
    cache = null;
  }
  const bytes = await fetchModule();
  await cache?.put(key, new Response(bytes as BlobPart)).catch(() => undefined);
  return bytes;
}

/** Downloads the file from its preview URL and hashes it like the server does. */
async function fetchFile(url: string, absPath: string): Promise<{ bytes: Uint8Array; sha256: string }> {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 404 ? t("fileMissing", { path: absPath }) : `HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error(t("tooLarge"));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return { bytes, sha256: [...digest].map((b) => b.toString(16).padStart(2, "0")).join("") };
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
  const composer = useComposer();
  const locale = detectLocale();
  const request = useMemo(
    () => ({
      path,
      locale,
      source: {
        kind: source.kind,
        threadId: source.threadId,
        environmentId: source.environmentId,
        projectId: source.projectId,
        hostId: source.experimental_hostId ?? null,
      },
    }),
    [path, locale, source.kind, source.threadId, source.environmentId, source.projectId, source.experimental_hostId],
  );

  const [doc, setDoc] = useState<Loaded | null>(null);
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [rev, setRev] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [freeze, setFreeze] = useState(() => globalThis.localStorage?.getItem(FREEZE_KEY) !== "off");
  const [anchor, setAnchor] = useState<Position | null>(null);
  const [focus, setFocus] = useState<Position | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [editing, setEditingState] = useState<Editing | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [stats, setStats] = useState<{ count: number; numbers: number; sum: number } | null>(null);
  const grid = useRef<GridHandle>(null);
  const cellInput = useRef<FormulaInputHandle>(null);
  const barInput = useRef<FormulaInputHandle>(null);
  const editingRef = useRef<Editing | null>(null);
  const touched = useRef(new Map<string, { sheet: number; row: number; col: number }>());
  const clipboard = useRef<ClipboardState | null>(null);

  const setEditing = useCallback((next: Editing | null) => {
    editingRef.current = next;
    setEditingState(next);
  }, []);

  const bump = useCallback(() => setRev((value) => value + 1), []);

  const touch = useCallback((sheet: number, range: Range) => {
    for (let row = range.r1; row <= range.r2; row++) {
      for (let col = range.c1; col <= range.c2; col++) touched.current.set(`${sheet}:${row}:${col}`, { sheet, row, col });
    }
    setDirty(true);
    setSaveState("idle");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      engineReady ??= engineBytes(() => rpc.call("engine", {}).then(({ base64 }) => decodeBase64(base64))).then(initEngine);
      const [result] = await Promise.all([
        rpc.call("open", request),
        engineReady.catch((cause) => {
          engineReady = null;
          throw new Error(`${t("engineFailed")}: ${errorText(cause)}`);
        }),
      ]);
      const { bytes, sha256 } = await fetchFile(result.url, result.absPath);
      const extension = extensionOf(result.absPath);
      let next: Workbook;
      try {
        next = buildWorkbook(parseWorkbook(bytes, extension), editMode(extension) === "csv" ? "csv" : "xlsx");
      } catch (cause) {
        throw new Error(`${t("parseFailed")}: ${errorText(cause)}`);
      }
      setWorkbook(next);
      setDoc({ bytes, hostName: result.hostName, absPath: result.absPath, sizeBytes: bytes.byteLength, sha256 });
      setActive((index) => (index < next.sheets.length ? index : 0));
      touched.current = new Map();
      clipboard.current = null;
      setDirty(false);
      setEditing(null);
      setError(null);
      bump();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [rpc, request, bump, setEditing]);

  useEffect(() => {
    setDoc(null);
    setActive(0);
    setAnchor(null);
    setFocus(null);
    void load();
  }, [load]);

  useEffect(() => () => workbook?.model.free(), [workbook]);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const editable = doc !== null && editMode(extensionOf(doc.absPath)) !== null;
  const base = workbook?.sheets[active] ?? null;

  // The active sheet as the engine computes it, with room to add data.
  const sheet = useMemo<Sheet | null>(() => {
    if (!workbook || !base) return null;
    let rows = base.rows;
    let cols = base.cols;
    for (const cell of touched.current.values()) {
      if (cell.sheet !== active) continue;
      rows = Math.max(rows, cell.row + 1);
      cols = Math.max(cols, cell.col + 1);
    }
    if (editable) {
      rows += EXTRA_ROWS;
      cols += EXTRA_COLS;
    }
    const cache = new Map<number, Cell | null>();
    return {
      ...base,
      rows,
      cols,
      widths: base.widths.concat(new Array(Math.max(0, cols - base.widths.length)).fill(NEW_COLUMN_WIDTH)),
      cell: (row, col) => {
        const key = row * 16_384 + col;
        if (!cache.has(key)) cache.set(key, engineCell(workbook, active, row, col));
        return cache.get(key)!;
      },
    };
  }, [workbook, base, active, editable, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => (sheet && appliedQuery.trim() ? findCells(sheet, appliedQuery) : []), [sheet, appliedQuery]);
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
  const single = range !== null && range.r1 === range.r2 && range.c1 === range.c2;
  const bounded = (r: Range): Range => (sheet ? { r1: r.r1, c1: r.c1, r2: Math.min(r.r2, sheet.rows - 1), c2: Math.min(r.c2, sheet.cols - 1) } : r);
  const cell = sheet && anchor ? sheet.cell(anchor.row, anchor.col) : null;

  // Status bar numbers, computed after the selection settles.
  useEffect(() => {
    setStats(null);
    if (!workbook || !sheet || !range || single) return;
    const timer = setTimeout(() => setStats(selectionStats(workbook, active, range, sheet.rows, sheet.cols)), 120);
    return () => clearTimeout(timer);
  }, [workbook, sheet, active, range?.r1, range?.c1, range?.r2, range?.c2]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Editing ----------------------------------------------------------

  const focusEditor = useCallback((state: Editing) => {
    requestAnimationFrame(() => {
      const target = state.target === "cell" && state.sheet === active ? cellInput.current : barInput.current;
      target?.focus(state.caret);
    });
  }, [active]);

  const startEdit = useCallback((position: Position, initial?: string, target: "cell" | "bar" = "cell") => {
    if (!sheet || !editable || editingRef.current) return;
    select(position);
    grid.current?.reveal(position);
    const draft = initial ?? editorText(sheet.cell(position.row, position.col));
    const state: Editing = { sheet: active, row: position.row, col: position.col, draft, caret: draft.length, point: null, pointer: null, typed: initial !== undefined, target };
    setEditing(state);
    focusEditor(state);
  }, [sheet, editable, active, select, setEditing, focusEditor]);

  const commitEdit = useCallback((move: [number, number] | null = null) => {
    const state = editingRef.current;
    if (!state || !workbook) return;
    setEditing(null);
    const original = editorText(engineCell(workbook, state.sheet, state.row, state.col));
    if (state.draft !== original) {
      try {
        applyInput(workbook, state.sheet, state.row, state.col, state.draft);
        touch(state.sheet, { r1: state.row, c1: state.col, r2: state.row, c2: state.col });
        bump();
      } catch (cause) {
        toast.error(`${t("inputRejected")}: ${errorText(cause)}`);
      }
    }
    if (active !== state.sheet) setActive(state.sheet);
    const next = move ? { row: Math.max(0, state.row + move[0]), col: Math.max(0, state.col + move[1]) } : { row: state.row, col: state.col };
    select(next);
    if (move) requestAnimationFrame(() => grid.current?.reveal(next));
  }, [workbook, active, touch, bump, select, setEditing]);

  const cancelEdit = useCallback(() => {
    const state = editingRef.current;
    if (!state) return;
    setEditing(null);
    if (active !== state.sheet) setActive(state.sheet);
    select({ row: state.row, col: state.col });
  }, [active, select, setEditing]);

  const pointing = editing !== null && canPoint(editing.draft, editing.caret, editing.point);

  const point = useCallback((from: Position, to: Position) => {
    const state = editingRef.current;
    if (!state || !workbook) return;
    const target = toRange(from, to);
    const ref = referenceText(target, active === state.sheet ? null : workbook.sheets[active].name);
    const inserted = insertReference(state.draft, state.caret, state.point, ref);
    const next = { ...state, draft: inserted.text, caret: inserted.caret, point: inserted.point, pointer: { anchor: from, focus: to } };
    setEditing(next);
    focusEditor(next);
  }, [workbook, active, setEditing, focusEditor]);

  const editorKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const state = editingRef.current;
    if (!state || !sheet) return;
    if (event.key === "Enter" && !event.altKey) {
      event.preventDefault();
      commitEdit([event.shiftKey ? -1 : 1, 0]);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      commitEdit([0, event.shiftKey ? -1 : 1]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
      return;
    }
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = arrows[event.key];
    if (!delta || event.metaKey || event.ctrlKey) return;
    if (canPoint(state.draft, state.caret, state.point) && (state.typed || state.point)) {
      event.preventDefault();
      const from = state.pointer?.focus ?? (active === state.sheet ? { row: state.row, col: state.col } : { row: 0, col: 0 });
      const next = { row: Math.min(sheet.rows - 1, Math.max(0, from.row + delta[0])), col: Math.min(sheet.cols - 1, Math.max(0, from.col + delta[1])) };
      point(event.shiftKey && state.pointer ? state.pointer.anchor : next, next);
      grid.current?.reveal(next);
      return;
    }
    if (state.typed && !isFormula(state.draft)) {
      event.preventDefault();
      commitEdit(delta);
    }
  };

  const updateDraft = (draft: string, caret: number) => {
    const state = editingRef.current;
    if (state) setEditing({ ...state, draft, caret, point: null, pointer: null });
  };

  const updateCaret = (caret: number) => {
    const state = editingRef.current;
    if (state && state.caret !== caret) setEditing({ ...state, caret });
  };

  // Reference highlights for the formula being edited (or the selected formula).
  const highlights = useMemo(() => {
    if (!workbook) return [];
    const text = editing ? editing.draft : cell?.formula ?? "";
    const home = workbook.sheets[editing?.sheet ?? active]?.name;
    const spans = referenceSpans(text);
    const colors = referenceColors(spans);
    return spans
      .filter((span) => (span.sheet ?? home) === workbook.sheets[active]?.name)
      .map((span) => ({ range: span.range, color: colors.get(colorKey(span))! }));
  }, [workbook, editing, cell?.formula, active]);

  // ---- Commands ----------------------------------------------------------

  const undo = useCallback(() => {
    if (!workbook?.model.canUndo()) return;
    workbook.model.undo();
    setDirty(true);
    bump();
  }, [workbook, bump]);

  const redo = useCallback(() => {
    if (!workbook?.model.canRedo()) return;
    workbook.model.redo();
    bump();
  }, [workbook, bump]);

  const clearRange = useCallback(() => {
    if (!workbook || !sheet || !range || !editable) return;
    const target = bounded(range);
    workbook.model.rangeClearContents(active, target.r1 + 1, target.c1 + 1, target.r2 + 1, target.c2 + 1);
    touch(active, target);
    bump();
  }, [workbook, sheet, range, editable, active, touch, bump]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyRange = useCallback((cut: boolean): string | null => {
    if (!workbook || !sheet || !range) return null;
    const target = bounded(range);
    if ((target.r2 - target.r1 + 1) * (target.c2 - target.c1 + 1) > MAX_PASTE) return rangeTsv(target, sheet.cell);
    const { model } = workbook;
    model.setSelectedSheet(active);
    model.setSelectedCell(target.r1 + 1, target.c1 + 1);
    model.setSelectedRange(target.r1 + 1, target.c1 + 1, target.r2 + 1, target.c2 + 1);
    const text = rangeTsv(target, sheet.cell);
    clipboard.current = { sheet: active, range: target, text, cut, clip: model.copyToClipboard() };
    return text;
  }, [workbook, sheet, range, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const paste = useCallback((text: string) => {
    if (!workbook || !sheet || !anchor || !editable) return;
    const { model } = workbook;
    const internal = clipboard.current;
    if (internal && text.replace(/\r?\n$/, "") === internal.text) {
      const height = internal.range.r2 - internal.range.r1 + 1;
      const width = internal.range.c2 - internal.range.c1 + 1;
      model.setSelectedSheet(active);
      model.setSelectedCell(anchor.row + 1, anchor.col + 1);
      model.setSelectedRange(anchor.row + 1, anchor.col + 1, anchor.row + height, anchor.col + width);
      model.pasteFromClipboard(internal.sheet, internal.clip.range, internal.clip.data, internal.cut);
      const target = { r1: anchor.row, c1: anchor.col, r2: anchor.row + height - 1, c2: anchor.col + width - 1 };
      touch(active, target);
      if (internal.cut) {
        touch(internal.sheet, internal.range);
        clipboard.current = null;
      }
      select({ row: target.r1, col: target.c1 }, { row: target.r2, col: target.c2 });
      bump();
      return;
    }
    const rows = parseTsv(text);
    const width = Math.max(...rows.map((row) => row.length));
    if (rows.length * width > MAX_PASTE) {
      toast.error(t("pasteTooLarge", { n: MAX_PASTE }));
      return;
    }
    model.pauseEvaluation();
    try {
      rows.forEach((values, r) => values.forEach((value, c) => {
        try {
          applyInput(workbook, active, anchor.row + r, anchor.col + c, value);
        } catch {
          /* keep going; the cell keeps its previous value */
        }
      }));
    } finally {
      model.resumeEvaluation();
      model.evaluate();
    }
    const target = { r1: anchor.row, c1: anchor.col, r2: anchor.row + rows.length - 1, c2: anchor.col + width - 1 };
    touch(active, target);
    select({ row: target.r1, col: target.c1 }, { row: target.r2, col: target.c2 });
    bump();
  }, [workbook, sheet, anchor, editable, active, touch, select, bump]);

  const pasteFromMenu = () => {
    navigator.clipboard.readText().then(paste, () => toast.error(t("pasteDenied")));
  };

  const fill = useCallback((from: Range, to: Range) => {
    if (!workbook || !editable) return;
    const area = { sheet: active, row: from.r1 + 1, column: from.c1 + 1, width: from.c2 - from.c1 + 1, height: from.r2 - from.r1 + 1 };
    try {
      if (to.r2 > from.r2) workbook.model.autoFillRows(area, to.r2 + 1);
      else if (to.r1 < from.r1) workbook.model.autoFillRows(area, to.r1 + 1);
      else if (to.c2 > from.c2) workbook.model.autoFillColumns(area, to.c2 + 1);
      else if (to.c1 < from.c1) workbook.model.autoFillColumns(area, to.c1 + 1);
    } catch (cause) {
      toast.error(errorText(cause));
      return;
    }
    touch(active, to);
    select({ row: to.r1, col: to.c1 }, { row: to.r2, col: to.c2 });
    bump();
  }, [workbook, editable, active, touch, select, bump]);

  const reference = () => (doc && base && range ? `${doc.absPath} · ${base.name}!${rangeLabel(range)}` : "");

  const quote = (text?: string) => {
    if (!doc || !base || !sheet || !range) return;
    const block = formatQuote({
      path: doc.absPath,
      host: doc.hostName,
      sheet: base.name,
      range: bounded(range),
      cellAt: sheet.cell,
      comment: text,
      more: (rows, cols) => t("more", { rows, cols }),
    });
    composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${block}\n\n`);
    composer.focus();
    toast.success(t("quoted"));
  };

  const save = useCallback(async (expected?: string) => {
    if (!doc || !workbook || saveState === "saving") return;
    if (editingRef.current) commitEdit();
    const bySheet = editsForSave(workbook, touched.current.values());
    if (bySheet.size === 0) {
      touched.current = new Map();
      setDirty(false);
      toast.message(t("nothingToSave"));
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      let sha = expected ?? doc.sha256;
      for (const [index, edits] of bySheet) {
        const result = await rpc.call("save", { ...request, expectedSha256: sha, sheet: { index, name: workbook.sheets[index].name }, edits });
        if (result.outcome === "conflict") {
          setSaveState("conflict");
          return;
        }
        sha = result.sha256;
      }
      setSaveState("idle");
      toast.success(t("saved"));
      await load();
    } catch (cause) {
      setSaveError(errorText(cause));
      setSaveState("error");
    }
  }, [doc, workbook, saveState, commitEdit, rpc, request, load]);

  const overwrite = async () => {
    try {
      const fresh = await rpc.call("open", request);
      await save((await fetchFile(fresh.url, fresh.absPath)).sha256);
    } catch (cause) {
      setSaveError(errorText(cause));
      setSaveState("error");
    }
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

  const switchSheet = (index: number) => {
    const state = editingRef.current;
    if (state && canPoint(state.draft, state.caret, state.point)) {
      const next = { ...state, target: "bar" as const, pointer: null };
      setEditing(next);
      setActive(index);
      requestAnimationFrame(() => barInput.current?.focus(next.caret));
      return;
    }
    if (state) commitEdit();
    setActive(index);
    setAnchor(null);
    setFocus(null);
  };

  const fileName = path.slice(path.lastIndexOf("/") + 1);
  const numberFormat = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 6 });
  const editorOnSheet = editing && editing.sheet === active ? { row: editing.row, col: editing.col } : null;
  const nameBox = editing ? cellAddress(editing.row, editing.col) : range ? rangeLabel(range) : "";

  const editorProps = (target: "cell" | "bar") => ({
    value: editing?.draft ?? "",
    caret: editing?.caret ?? 0,
    locale,
    onChange: updateDraft,
    onCaret: updateCaret,
    onKeyDown: editorKeyDown,
    onFocus: () => {
      const state = editingRef.current;
      if (state && state.target !== target) setEditing({ ...state, target });
    },
  });

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
        {editable ? (
          <>
            <ToolButton label={`${t("undo")} (${MOD}Z)`} onClick={undo} disabled={!workbook?.model.canUndo()}><Icon name="ArrowTurnBackward" className="size-4" /></ToolButton>
            <ToolButton label={`${t("redo")} (${MOD}${isMac ? "⇧Z" : "Y"})`} onClick={redo} disabled={!workbook?.model.canRedo()}><Icon name="ArrowTurnForward" className="size-4" /></ToolButton>
          </>
        ) : null}
        <ToolButton label={freeze ? t("freezeOn") : t("freezeOff")} onClick={toggleFreeze} disabled={!sheet}>
          <Icon name={freeze ? "Pin" : "PinOff"} className={cn("size-4", freeze && "text-foreground")} />
        </ToolButton>
        <ToolButton label={t("refresh")} onClick={() => void load()} disabled={loading || dirty}>
          <Icon name={loading ? "Spinner" : "ArrowReloadHorizontal"} className={cn("size-4", loading && "animate-spin")} />
        </ToolButton>
        <ToolButton label={t("download")} onClick={download} disabled={!doc}>
          <Icon name="Download" className="size-4" />
        </ToolButton>
      </div>

      {dirty || saveState !== "idle" ? (
        <div role="status" className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-1 text-xs">
          {saveState === "conflict" ? (
            <>
              <Icon name="AlertTriangle" className="size-3.5 text-amber-500" />
              <span className="flex-1">{t("conflict")}</span>
              <Button variant="outline" size="sm" className="h-7" onClick={() => void load()}>{t("reloadTheirs")}</Button>
              <Button size="sm" className="h-7" onClick={() => void overwrite()}>{t("overwrite")}</Button>
            </>
          ) : (
            <>
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              <span>{t("unsavedChanges")}</span>
              {saveState === "error" ? <span className="min-w-0 flex-1 truncate text-destructive" title={saveError ?? ""}>{t("saveFailed")}: {saveError}</span> : <span className="flex-1" />}
              <Button variant="ghost" size="sm" className="h-7" onClick={() => void load()} disabled={saveState === "saving"}>{t("discard")}</Button>
              <Button size="sm" className="h-7" onClick={() => void save()} disabled={saveState === "saving"}>
                {saveState === "saving" ? t("saving") : t("save")} <span className="opacity-70">{MOD}S</span>
              </Button>
            </>
          )}
        </div>
      ) : null}

      {sheet ? (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2 text-xs" data-bb-ru-skip="">
          <span className="w-24 shrink-0 truncate rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground" aria-label={t("nameBox")}>{nameBox}</span>
          <span className="shrink-0 font-serif italic text-muted-foreground" aria-hidden>fx</span>
          {editing ? (
            <FormulaInput ref={barInput} {...editorProps("bar")} ariaLabel={t("formulaBar")} autoFocus={editing.target === "bar"} className="h-6 min-w-0 flex-1 font-mono" />
          ) : (
            <FormulaInput
              ref={barInput}
              value={single ? editorText(cell) : ""}
              caret={0}
              locale={locale}
              readOnly={!editable || !single}
              ariaLabel={t("formulaBar")}
              onChange={() => undefined}
              onCaret={() => undefined}
              onFocus={() => {
                if (editable && single && anchor) startEdit(anchor, undefined, "bar");
              }}
              className="h-6 min-w-0 flex-1 font-mono"
            />
          )}
          {single && cell?.link ? (
            <ToolButton label={t("openLink")} onClick={() => navigate.openUrl(cell.link!)}><Icon name="ArrowUpRight" className="size-4" /></ToolButton>
          ) : null}
          {range ? (
            <ToolButton label={t("quote")} onClick={() => quote()}><Icon name="MessageSquarePlus" className="size-3.5" /></ToolButton>
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
            ) : !doc || !sheet ? (
              <Status>{t("loading")}</Status>
            ) : sheet.cols === 0 ? (
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
                highlights={highlights}
                editable={editable}
                editing={editorOnSheet}
                editor={
                  editing && editing.sheet === active ? (
                    <FormulaInput ref={cellInput} {...editorProps("cell")} ariaLabel={t("edit")} autoFocus={editing.target === "cell"} className="h-full w-full text-xs" />
                  ) : null
                }
                pointing={pointing}
                onPoint={point}
                onStartEdit={(position, initial) => startEdit(position, initial)}
                onCommitEdit={() => commitEdit()}
                onClear={clearRange}
                onUndo={undo}
                onRedo={redo}
                onCopy={copyRange}
                onPaste={paste}
                onFill={fill}
                onOpenLink={(url) => navigate.openUrl(url)}
                hints={{ link: t("linkHint"), unsupported: t("unsupportedHint") }}
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
          {editable ? (
            <ContextMenuItem disabled={!range} onSelect={() => { const text = copyRange(true); if (text !== null) void navigator.clipboard.writeText(text); }}>
              <Icon name="Target" className="size-4" /> {t("cut")} <ContextMenuShortcut>{MOD}X</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem
            disabled={!range}
            onSelect={() => {
              const text = copyRange(false);
              if (text !== null) navigator.clipboard.writeText(text).then(() => toast.success(t("copied")), (cause) => toast.error(errorText(cause)));
            }}
          >
            <Icon name="Copy" className="size-4" /> {t("copyCells")} <ContextMenuShortcut>{MOD}C</ContextMenuShortcut>
          </ContextMenuItem>
          {editable ? (
            <ContextMenuItem disabled={!anchor} onSelect={pasteFromMenu}>
              <Icon name="Download" className="size-4" /> {t("paste")} <ContextMenuShortcut>{MOD}V</ContextMenuShortcut>
            </ContextMenuItem>
          ) : null}
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
              <ContextMenuItem disabled={!workbook?.model.canUndo()} onSelect={undo}>
                <Icon name="ArrowTurnBackward" className="size-4" /> {t("undo")} <ContextMenuShortcut>{MOD}Z</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem disabled={!workbook?.model.canRedo()} onSelect={redo}>
                <Icon name="ArrowTurnForward" className="size-4" /> {t("redo")} <ContextMenuShortcut>{MOD}{isMac ? "⇧Z" : "Y"}</ContextMenuShortcut>
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>

      {workbook && workbook.sheets.length ? (
        <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border pl-1 pr-3">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" role="tablist" aria-label={t("sheets")} data-bb-ru-skip="">
            {workbook.sheets.map((item, index) => (
              <button
                key={`${index}:${item.name}`}
                type="button"
                role="tab"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  if (editingRef.current) event.preventDefault();
                }}
                onClick={() => switchSheet(index)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
                  index === active && "bg-accent font-medium text-foreground",
                  item.hidden && "italic",
                )}
              >
                {[...touched.current.values()].some((c) => c.sheet === index) ? <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> : null}
                {item.name}
                {item.hidden ? <span className="text-muted-foreground">({t("hidden")})</span> : null}
              </button>
            ))}
          </div>
          {stats && stats.count > 0 ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {stats.numbers > 0 ? `${t("sum")}: ${numberFormat.format(stats.sum)} · ${t("average")}: ${numberFormat.format(stats.sum / stats.numbers)} · ` : ""}
              {t("count")}: {stats.count}
            </span>
          ) : base ? (
            <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">{t("size", { rows: base.rows, cols: base.cols })}</span>
          ) : null}
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
  app.slots.fileOpener({
    id: "media",
    title: "Office Viewer — media",
    extensions: MEDIA_EXTENSIONS,
    component: MediaOpener,
  });
  app.slots.fileOpener({
    id: "word",
    title: "Office Viewer — Word",
    extensions: WORD_EXTENSIONS,
    component: DocumentOpener,
  });
  app.slots.fileOpener({
    id: "pdf",
    title: "Office Viewer — PDF",
    extensions: PDF_EXTENSIONS,
    component: PdfOpener,
  });
});
