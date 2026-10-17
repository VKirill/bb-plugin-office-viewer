import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useComposer, useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { rpcContract } from "../../../server";
import { studioLocale, useT } from "../../shared/i18n";
import { patchThreadSession, readThreadSession } from "../session";
import { getStudioSettings, patchStudioSettings, useStudioSettings } from "../settings-store";
import { useChatAutosave } from "../use-chat-autosave";
import {
  CATALOG_BY_TYPE,
  SNAP,
  canvasPresetDimensions,
  cloneWireframe,
  defaultElement,
  newElementId,
  newWireframe,
  parseWireframe,
  type PaletteGroup,
  type PropValue,
  type Wireframe,
  type WireframeElement,
  getActivePage,
  updateActivePage,
  setActivePageId,
  newPage,
  nextPageName,
} from "./model";
import { PrototypeShell, PrototypeStyleBar } from "./shell";
import { PrototypeToolbar, type ToolbarMenu } from "./toolbar";
import { PrototypeLeftPane, type LeftTopTab, type PaletteLibraryView } from "./left-pane";
import { PrototypeCanvas } from "./canvas";
import { PrototypeInspector, type InspectorTab } from "./inspector";
import { assignRadioGroup, createRadioGroup, setRadioChecked } from "./inspector-model";
import { blobToBase64, loadScreenshotLibrary, noteNumbers, placeOnCanvas, resized, selectionBounds, type Handle } from "./builder-geometry";
import { PALETTE_BY_ID, PALETTE_TILES, elementFromTile, tileMatchesQuery, type PaletteTile } from "./palette";
import {
  addChoiceSibling,
  applyInlineDraft,
  checkRadio,
  draftUnchanged,
  enterOnListItem,
  itemIndexAt,
  itemListKey,
  readDraft,
  removeEmptyListItem,
  simpleEditKey,
  stringList,
  toggleCheckbox,
  type InlineEdit,
} from "./editing";
import { alignElements, distributeElements, type AlignEdge, type DistributeAxis } from "./align";
import { ICON_DRAG_PREFIX, iconDisplayLabel } from "./icons";
import { TEMPLATE_DRAG_PREFIX, insertTemplateElements } from "./templates";
import {
  activeModifierLabels,
  arrowNudge,
  CANVAS_TOOL_KEYS,
  CLICK_DRAG_THRESHOLD,
  clickSelection,
  constrainMove,
  distanceLinesFor,
  drawRect,
  elementAtPoint,
  expandToGroups,
  groupIds,
  isDragDrawTool,
  marqueeHitTest,
  moveElementsByDelta,
  normalizeRect,
  nudgeStep,
  resizeByArrow,
  selectionRect,
  snapDelta,
  snapRectToPeers,
  type CanvasModifiers,
  type CanvasRect,
  type DistanceLine,
  type ElementBox,
  type QuickTool,
  type SnapGuide,
  ungroupIds,
  zoomIn,
  zoomOut,
  zoomToBounds,
  zoomToFit,
} from "./canvas-math";
import { ProtoShortcutsSheet } from "./proto-shortcuts-sheet";
import { PrototypeContextMenu, type ContextMenuAction } from "./canvas-context-menu";

const MAX_HISTORY = 60;

type Drag =
  | { kind: "move"; ids: string[]; ox: number; oy: number; orig: Record<string, { x: number; y: number }> }
  | { kind: "resize"; id: string; handle: Handle; orig: WireframeElement }
  | {
      kind: "draw";
      tool: QuickTool;
      ax: number;
      ay: number;
      panX: number;
      panY: number;
      ex: number;
      ey: number;
      lastX: number;
      lastY: number;
    }
  | { kind: "marquee"; ox: number; oy: number; contain: boolean }
  | { kind: "pan"; startX: number; startY: number; scrollLeft: number; scrollTop: number };
type SendKind = "both" | "png" | "json";

function blankWireframe() {
  const settings = getStudioSettings();
  return newWireframe(undefined, { ...canvasPresetDimensions(settings.protoPreset), background: "#ffffff" });
}

function pageElements(doc: Wireframe) { return getActivePage(doc).elements; }
function pageCanvas(doc: Wireframe) { return getActivePage(doc).canvas; }
function patchElements(doc: Wireframe, elements: WireframeElement[]) { return updateActivePage(doc, (p) => ({ ...p, elements })); }
function patchCanvas(doc: Wireframe, patch: Partial<Wireframe["pages"][0]["canvas"]>) { return updateActivePage(doc, (p) => ({ ...p, canvas: { ...p.canvas, ...patch } })); }

export function PrototypeBuilder({ threadId }: { threadId: string }) {
  const t = useT();
  const settings = useStudioSettings();
  const rpc = useRpc<typeof rpcContract>();
  const composer = useComposer();
  const locale = studioLocale();
  const restored = readThreadSession(threadId).prototype;
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const canvasPaneRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const spaceHeld = useRef(false);
  const clipboard = useRef<WireframeElement[]>([]);
  const [{ history, index }, setTimeline] = useState(() => ({ history: [restored?.doc ?? blankWireframe()], index: 0 }));
  const doc = history[index]!;
  const [live, setLive] = useState<Wireframe | null>(null);
  const view = live ?? doc;
  const [selected, setSelected] = useState<string[]>(() => restored?.selected ?? []);
  const badges = settings.protoBadges;
  const snapGrid = settings.protoSnap;
  const [zoom, setZoom] = useState(() => restored?.zoom ?? 1);
  const [marquee, setMarquee] = useState<CanvasRect | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [distanceLines, setDistanceLines] = useState<DistanceLine[]>([]);
  const [moveTooltip, setMoveTooltip] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [pendingTool, setPendingTool] = useState<QuickTool | null>(null);
  const [drawPreview, setDrawPreview] = useState<ElementBox | null>(null);
  const [modifiers, setModifiers] = useState<CanvasModifiers>({ shift: false, alt: false, meta: false, space: false });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickInsertOpen, setQuickInsertOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  
  const [leftTab, setLeftTab] = useState<LeftTopTab>("pages");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("style");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftOverlay, setLeftOverlay] = useState(false);
  const [rightOverlay, setRightOverlay] = useState(false);
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => (restored?.openTabIds.length ? restored.openTabIds : [getActivePage(doc).id]));
  const shellRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
const [paletteView, setPaletteView] = useState<PaletteLibraryView>("elements");
  const [collapsed, setCollapsed] = useState<Partial<Record<PaletteGroup, boolean>>>({ flow: true });
  const [busy, setBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [menu, setMenu] = useState<ToolbarMenu | null>(null);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [openedStem, setOpenedStem] = useState<string | null>(() => restored?.openedStem ?? null);
  const autosaveRef = useRef<() => Promise<void>>(async () => {});
  const autosaveStatus = useChatAutosave(JSON.stringify(doc), () => autosaveRef.current());
  const [saveName, setSaveName] = useState(() => t("protoUntitled"));
  const [nameDraft, setNameDraft] = useState(doc.name);
  const [edit, setEdit] = useState<InlineEdit | null>(null);
  const editRef = useRef<InlineEdit | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const skipBlur = useRef(false);
  editRef.current = edit;
  const editFocusKey = edit
    ? edit.target.kind === "item"
      ? `${edit.id}:${edit.target.key}:${edit.target.index}`
      : `${edit.id}:${edit.target.key}`
    : "";

  useEffect(() => {
    if (!editFocusKey) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editFocusKey]);

  useEffect(() => {
    setNameDraft(doc.name);
  }, [doc.name]);

  useEffect(() => {
    patchThreadSession(threadId, { tool: "prototype", prototype: { doc, openedStem, zoom, selected, openTabIds } });
  }, [threadId, doc, openedStem, zoom, selected, openTabIds]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setCompact((entries[0]?.contentRect.width ?? el.clientWidth) < 900);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("[data-toolbar-menu]")) return;
      setMenu(null);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [menu]);

  const commit = useCallback((next: Wireframe) => {
    setLive(null);
    setTimeline((s) => {
      const kept = s.history.slice(Math.max(0, s.index + 1 - MAX_HISTORY), s.index + 1);
      return { history: [...kept, cloneWireframe(next)], index: kept.length };
    });
  }, []);

  const undo = () => setTimeline((s) => ({ ...s, index: Math.max(0, s.index - 1) }));
  const redo = () => setTimeline((s) => ({ ...s, index: Math.min(s.history.length - 1, s.index + 1) }));

  const replace = (elements: WireframeElement[]) => commit(patchElements(doc, elements));

  const addTile = (tile: PaletteTile, x?: number, y?: number) => {
    const spec = CATALOG_BY_TYPE[tile.type];
    const el = placeOnCanvas(
      elementFromTile(tile, x ?? (pageCanvas(doc).width - spec.w) / 2, y ?? (pageCanvas(doc).height - spec.h) / 2, pageElements(doc)),
      pageCanvas(doc),
    );
    replace([...pageElements(doc), el]);
    setSelected([el.id]);
  };

  const addQuickTool = (tool: QuickTool, x: number, y: number) => {
    const base = defaultElement(tool.type, x, y, pageElements(doc));
    const el = placeOnCanvas(
      { ...base, props: { ...base.props, ...(tool.props ?? {}) } },
      pageCanvas(doc),
    );
    replace([...pageElements(doc), el]);
    setSelected([el.id]);
  };

  const placeDrawnElement = (tool: QuickTool, box: ElementBox) => {
    const base = defaultElement(tool.type, box.x, box.y, pageElements(doc));
    const el = placeOnCanvas(
      { ...base, props: { ...base.props, ...(tool.props ?? {}) }, w: box.w, h: box.h },
      pageCanvas(doc),
    );
    replace([...pageElements(doc), el]);
    setSelected([el.id]);
  };

  const cancelActiveDrag = () => {
    drag.current = null;
    setDrawPreview(null);
    setMarquee(null);
    setSnapGuides([]);
    setMoveTooltip(null);
    setLive(null);
  };

  const syncPointerModifiers = (event: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    setModifiers((m) => ({
      ...m,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey || event.ctrlKey,
    }));
  };

  const addTemplate = (templateId: string, x?: number, y?: number) => {
    const canvas = pageCanvas(doc);
    const centerX = x ?? canvas.width / 2;
    const centerY = y ?? canvas.height / 2;
    const built = insertTemplateElements(templateId, centerX, centerY, pageElements(doc));
    if (!built?.length) return;
    const placed = built.map((el) => placeOnCanvas(el, canvas));
    replace([...pageElements(doc), ...placed]);
    setSelected(placed.map((el) => el.id));
  };

  const addIconFromLibrary = (iconName: string, x?: number, y?: number) => {
    const size = 24;
    const el = placeOnCanvas(
      {
        ...defaultElement("Icon", x ?? (pageCanvas(doc).width - size) / 2, y ?? (pageCanvas(doc).height - size) / 2, pageElements(doc)),
        props: { name: iconName, size, color: "foreground" },
        label: iconDisplayLabel(iconName),
        w: size,
        h: size,
      },
      pageCanvas(doc),
    );
    replace([...pageElements(doc), el]);
    setSelected([el.id]);
  };

  const selectedEls = pageElements(view).filter((el) => selected.includes(el.id));
  const one = selectedEls.length === 1 ? selectedEls[0] : null;
  const inspect = one && edit?.id === one.id ? applyInlineDraft(one, edit) : one;
  const notes = useMemo(() => noteNumbers(pageElements(view)), [pageElements(view)]);

  const updateOne = (patch: Partial<WireframeElement>) => {
    if (!one) return;
    replace(pageElements(doc).map((el) => (el.id === one.id ? { ...el, ...patch } : el)));
  };

  const updateMany = (mapper: (el: WireframeElement) => WireframeElement) => {
    replace(pageElements(doc).map((el) => mapper(el)));
  };

  const replaceElement = (next: WireframeElement) => {
    replace(pageElements(doc).map((el) => (el.id === next.id ? next : el)));
  };

  const setProp = (key: string, value: PropValue) => {
    if (!one) return;
    if (one.type === "Radio" && key === "checked") {
      replace(setRadioChecked(pageElements(doc), one.id, value === true));
      return;
    }
    updateOne({ props: { ...one.props, [key]: value } });
  };

  const removeSelected = () => {
    if (!selected.length) return;
    replace(pageElements(doc).filter((el) => !selected.includes(el.id)));
    setSelected([]);
  };

  const duplicateSelected = () => {
    if (!selected.length) return;
    const copies = pageElements(doc)
      .filter((el) => selected.includes(el.id))
      .map((el) => placeOnCanvas({ ...structuredClone(el), id: newElementId(), x: el.x + SNAP * 2, y: el.y + SNAP * 2 }, pageCanvas(doc)));
    replace([...pageElements(doc), ...copies]);
    setSelected(copies.map((el) => el.id));
  };

  const copySelected = () => {
    clipboard.current = selectedEls.map((el) => structuredClone(el));
  };

  const cutSelected = () => {
    copySelected();
    removeSelected();
  };

  const groupSelected = () => {
    if (selected.length < 2) return;
    replace(groupIds(pageElements(doc), selected));
  };

  const ungroupSelected = () => {
    replace(ungroupIds(pageElements(doc), selected));
  };

  const toggleLockSelected = () => {
    if (!selected.length) return;
    const pick = new Set(selected);
    const locking = pageElements(doc).some((el) => pick.has(el.id) && !el.locked);
    replace(pageElements(doc).map((el) => (pick.has(el.id) ? { ...el, locked: locking } : el)));
  };

  const setHiddenSelected = (hidden?: boolean) => {
    if (!selected.length) return;
    const pick = new Set(selected);
    const nextHidden = hidden ?? !pageElements(doc).some((el) => pick.has(el.id) && el.hidden);
    replace(pageElements(doc).map((el) => (pick.has(el.id) ? { ...el, hidden: nextHidden } : el)));
  };

  const paste = () => {
    if (!clipboard.current.length) return;
    const copies = clipboard.current.map((el) =>
      placeOnCanvas({ ...structuredClone(el), id: newElementId(), x: el.x + SNAP * 2, y: el.y + SNAP * 2 }, pageCanvas(doc)),
    );
    clipboard.current = copies;
    replace([...pageElements(doc), ...copies]);
    setSelected(copies.map((el) => el.id));
  };

  const commitName = () => {
    const name = nameDraft.trim() || t("protoUntitled");
    setNameDraft(name);
    if (name !== doc.name) commit({ ...doc, name });
  };

  const applyAlign = (edge: AlignEdge) => {
    if (!selected.length) return;
    replace(alignElements(pageElements(doc), selected, edge, pageCanvas(doc)));
  };

  const applyDistribute = (axis: DistributeAxis) => {
    if (selected.length < 3) return;
    replace(distributeElements(pageElements(doc), selected, axis));
  };

  const fitZoom = () => {
    const pane = canvasPaneRef.current;
    if (!pane) return;
    setZoom(zoomToFit(pageCanvas(doc).width, pageCanvas(doc).height, pane.clientWidth, pane.clientHeight));
  };

  const zoomSelection = () => {
    const pane = canvasPaneRef.current;
    const bounds = selectionRect(pageElements(doc), selected);
    if (!pane || !bounds) return;
    setZoom(zoomToBounds(bounds, pane.clientWidth, pane.clientHeight));
  };

  const toggleMenu = (id: ToolbarMenu) => setMenu((was) => (was === id ? null : id));

  const nudgeLayer = (delta: 1 | -1) => {
    if (!selected.length) return;
    const next = [...pageElements(doc)];
    const ids = new Set(selected);
    const indexes = next.map((el, i) => (ids.has(el.id) ? i : -1)).filter((i) => i >= 0);
    const walk = delta === 1 ? [...indexes].reverse() : indexes;
    for (const i of walk) {
      const j = i + delta;
      if (j < 0 || j >= next.length || ids.has(next[j]!.id)) continue;
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    replace(next);
  };

  const boardPoint = (event: { clientX: number; clientY: number }) => {
    const box = boardRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return { x: (event.clientX - box.left) / zoom, y: (event.clientY - box.top) / zoom };
  };

  const onPanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (!spaceHeld.current && event.button !== 1) return;
    const pane = canvasPaneRef.current;
    if (!pane) return;
    drag.current = {
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: pane.scrollLeft,
      scrollTop: pane.scrollTop,
    };
    setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPanePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (current?.kind !== "pan") return;
    const pane = canvasPaneRef.current;
    if (!pane) return;
    pane.scrollLeft = current.scrollLeft - (event.clientX - current.startX);
    pane.scrollTop = current.scrollTop - (event.clientY - current.startY);
  };

  const onPanePointerUp = () => {
    if (drag.current?.kind === "pan") {
      drag.current = null;
      setPanning(false);
    }
  };

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (spaceHeld.current) return;
    if ((event.target as HTMLElement).closest("input")) return;
    syncPointerModifiers(event);
    setContextMenu(null);
    const handle = (event.target as HTMLElement).dataset.handle as Handle | undefined;
    const id = (event.target as HTMLElement).closest("[data-el]")?.getAttribute("data-el");
    const p = boardPoint(event);
    if (pendingTool && isDragDrawTool(pendingTool) && !handle) {
      drag.current = {
        kind: "draw",
        tool: pendingTool,
        ax: p.x,
        ay: p.y,
        panX: 0,
        panY: 0,
        ex: p.x,
        ey: p.y,
        lastX: p.x,
        lastY: p.y,
      };
      setDrawPreview(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (pendingTool && !handle) {
      addQuickTool(pendingTool, p.x, p.y);
      return;
    }
    if (handle && one) {
      drag.current = { kind: "resize", id: one.id, handle, orig: { ...one, props: { ...one.props } } };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (id) {
      const target = pageElements(view).find((item) => item.id === id);
      if (target?.locked) return;
      const picked = clickSelection(selected, id, event.metaKey || event.ctrlKey, event.shiftKey);
      let ids = expandToGroups(pageElements(view), picked);
      setSelected(ids);
      let elements = pageElements(doc);
      if (event.altKey) {
        const copies = elements
          .filter((el) => ids.includes(el.id))
          .map((el) =>
            placeOnCanvas({ ...structuredClone(el), id: newElementId(), x: el.x, y: el.y }, pageCanvas(doc)),
          );
        elements = [...elements, ...copies];
        ids = copies.map((el) => el.id);
        setLive(patchElements(doc, elements));
        setSelected(ids);
      }
      const orig: Record<string, { x: number; y: number }> = {};
      const source = live ? pageElements(live) : elements;
      for (const el of source) if (ids.includes(el.id)) orig[el.id] = { x: el.x, y: el.y };
      drag.current = { kind: "move", ids, ox: p.x, oy: p.y, orig };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) setSelected([]);
    drag.current = { kind: "marquee", ox: p.x, oy: p.y, contain: event.altKey };
    setMarquee(normalizeRect(p.x, p.y, p.x, p.y));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    const p = boardPoint(event);
    syncPointerModifiers(event);
    if (!current) {
      if (event.altKey) {
        const hit = elementAtPoint(pageElements(view), p.x, p.y);
        setDistanceLines(hit ? distanceLinesFor(hit, pageElements(view)) : []);
      } else setDistanceLines([]);
      return;
    }
    if (current.kind === "draw") {
      if (spaceHeld.current) {
        current.panX += p.x - current.lastX;
        current.panY += p.y - current.lastY;
      } else {
        current.ex = p.x;
        current.ey = p.y;
      }
      current.lastX = p.x;
      current.lastY = p.y;
      const box = drawRect(
        current.ax + current.panX,
        current.ay + current.panY,
        current.ex,
        current.ey,
        current.tool.type,
        { shift: event.shiftKey, alt: event.altKey },
      );
      setDrawPreview(box);
      return;
    }
    if (current.kind === "marquee") {
      setMarquee(normalizeRect(current.ox, current.oy, p.x, p.y));
      return;
    }
    if (current.kind === "move") {
      let dx = p.x - current.ox;
      let dy = p.y - current.oy;
      const constrained = constrainMove(dx, dy, event.shiftKey);
      dx = constrained.dx;
      dy = constrained.dy;
      const baseElements = live ? pageElements(live) : pageElements(doc);
      const bounds = selectionRect(
        baseElements.map((el) => {
          const from = current.orig[el.id];
          return from ? { ...el, x: from.x + dx, y: from.y + dy } : el;
        }),
        current.ids,
      );
      const guides: SnapGuide[] = [];
      const snapOff = event.metaKey || event.ctrlKey;
      if (bounds && !snapOff) {
        const peerSnap = snapRectToPeers(bounds, pageElements(doc), new Set(current.ids));
        dx += peerSnap.dx;
        dy += peerSnap.dy;
        guides.push(...peerSnap.guides);
      }
      const grid = snapGrid && !snapOff ? settings.protoGridStep : null;
      const snapped = snapDelta(dx, dy, grid);
      setSnapGuides(guides);
      if (bounds) {
        setMoveTooltip({ x: bounds.left + snapped.dx, y: bounds.top + snapped.dy, w: bounds.right - bounds.left, h: bounds.bottom - bounds.top });
      }
      setLive(patchElements(doc, moveElementsByDelta(baseElements, new Set(current.ids), snapped.dx, snapped.dy, current.orig)));
      return;
    }
    if (current.kind === "resize") {
      const mods = { shift: event.shiftKey, alt: event.altKey };
      setLive(
        patchElements(
          doc,
          pageElements(doc).map((el) => (el.id === current.id ? resized(current.orig, current.handle, p.x, p.y, mods) : el)),
        ),
      );
    }
  };

  const onBoardPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    setSnapGuides([]);
    setMoveTooltip(null);
    syncPointerModifiers(event);
    if (current?.kind === "draw") {
      const p = boardPoint(event);
      setDrawPreview(null);
      const dist = Math.hypot(p.x - current.ax, p.y - current.ay);
      if (dist < CLICK_DRAG_THRESHOLD) {
        addQuickTool(current.tool, current.ax, current.ay);
      } else {
        const box = drawRect(
          current.ax + current.panX,
          current.ay + current.panY,
          current.ex,
          current.ey,
          current.tool.type,
          { shift: event.shiftKey, alt: event.altKey },
        );
        placeDrawnElement(current.tool, box);
      }
      return;
    }
    if (current?.kind === "marquee") {
      const p = boardPoint(event);
      const rect = normalizeRect(current.ox, current.oy, p.x, p.y);
      setMarquee(null);
      const hits = marqueeHitTest(pageElements(view), rect, current.contain ? "contain" : "intersect");
      setSelected(expandToGroups(pageElements(view), hits));
      return;
    }
    setMarquee(null);
    if (current?.kind === "move") {
      const p = boardPoint(event);
      const grid = snapGrid ? settings.protoGridStep : null;
      const raw = snapDelta(p.x - current.ox, p.y - current.oy, grid);
      if (raw.dx === 0 && raw.dy === 0) {
        const el = pageElements(doc).find((item) => current.ids[0] === item.id);
        if (el && event.detail === 1 && (el.type === "Radio" || el.type === "Checkbox") && p.x - el.x < 28) {
          setLive(null);
          replace(el.type === "Radio" ? checkRadio(pageElements(doc), el.id) : toggleCheckbox(pageElements(doc), el.id));
          return;
        }
        setLive(null);
        return;
      }
    }
    if (!current || !live) {
      setLive(null);
      return;
    }
    commit(live);
  };

  const onBoardContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const id = (event.target as HTMLElement).closest("[data-el]")?.getAttribute("data-el");
    if (id && !selected.includes(id)) setSelected(expandToGroups(pageElements(view), [id]));
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  const onContextAction = (action: ContextMenuAction) => {
    if (action === "cut") cutSelected();
    else if (action === "copy") copySelected();
    else if (action === "paste") paste();
    else if (action === "duplicate") duplicateSelected();
    else if (action === "delete") removeSelected();
    else if (action === "group") groupSelected();
    else if (action === "ungroup") ungroupSelected();
    else if (action === "lock" || action === "unlock") toggleLockSelected();
    else if (action === "hide") setHiddenSelected(true);
    else if (action === "show") setHiddenSelected(false);
    else if (action === "bringForward") nudgeLayer(1);
    else if (action === "sendBackward") nudgeLayer(-1);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    const p = boardPoint(event);
    if (raw.startsWith(ICON_DRAG_PREFIX)) {
      const iconName = raw.slice(ICON_DRAG_PREFIX.length);
      if (!iconName) return;
      addIconFromLibrary(iconName, p.x - 12, p.y - 12);
      return;
    }
    if (raw.startsWith(TEMPLATE_DRAG_PREFIX)) {
      const templateId = raw.slice(TEMPLATE_DRAG_PREFIX.length);
      if (!templateId) return;
      addTemplate(templateId, p.x, p.y);
      return;
    }
    const tile = PALETTE_BY_ID[raw];
    if (!tile) return;
    const spec = CATALOG_BY_TYPE[tile.type];
    addTile(tile, p.x - spec.w / 2, p.y - spec.h / 2);
  };

  const capturePng = async () => {
    const node = boardRef.current;
    if (!node) throw new Error(t("protoCaptureFailed"));
    const lib = await loadScreenshotLibrary();
    return lib.domToBlob(node, {
      scale: 2,
      type: "image/png",
      filter: (item) => !(item instanceof Element && item.hasAttribute("data-proto-skip")),
    });
  };

  const persist = async (name: string, overwrite: boolean) => {
    const png = await capturePng();
    const saved = await rpc.call("saveWireframe", {
      threadId,
      name,
      json: JSON.stringify({ ...doc, name }),
      pngBase64: await blobToBase64(png),
      overwrite,
      locale,
    });
    commit({ ...doc, name });
    setOpenedStem(saved.name);
    return { ...saved, png };
  };

  autosaveRef.current = async () => {
    const name = openedStem ?? t("protoUntitled");
    let pngBase64: string | undefined;
    try {
      pngBase64 = await blobToBase64(await capturePng());
    } catch {
      pngBase64 = undefined;
    }
    const saved = await rpc.call("saveWireframe", {
      threadId,
      name,
      json: JSON.stringify({ ...doc, name }),
      pngBase64,
      overwrite: true,
      locale,
    });
    setOpenedStem(saved.name);
  };

  const sendToChat = async (kind: SendKind) => {
    setMenu(null);
    setBusy(true);
    try {
      const saved = await persist(openedStem ?? doc.name, Boolean(openedStem));
      const files: File[] = [];
      if (kind !== "json") files.push(new File([saved.png], `${saved.name}.png`, { type: "image/png" }));
      if (kind !== "png") files.push(new File([JSON.stringify({ ...doc, name: saved.name }, null, 2)], `${saved.name}.wireframe.json`, { type: "application/json" }));
      const attach = (composer as typeof composer & { experimental_vkAttachFiles?: (files: File[]) => Promise<void> }).experimental_vkAttachFiles;
      if (typeof attach === "function") {
        await attach.call(composer, files);
        toast.success(t("protoSentChat"));
        return;
      }
      const note =
        kind === "png"
          ? t("protoSendFallbackPng", { png: saved.pngPath })
          : kind === "json"
            ? t("protoSendFallbackJson", { json: saved.jsonPath })
            : t("protoSendFallback", { json: saved.jsonPath, png: saved.pngPath });
      composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${note}\n\n`);
      composer.focus();
      toast.success(t("protoSentChat"));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const save = async (overwrite: boolean) => {
    setBusy(true);
    try {
      const saved = await persist(saveName.trim() || doc.name, overwrite);
      toast.success(t("protoSavedAs", { name: saved.name }));
      setSaveOpen(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const loadList = async () => {
    try {
      setSavedNames((await rpc.call("listWireframes", { threadId, locale })).names);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const loadOne = async (name: string) => {
    setBusy(true);
    try {
      const loaded = await rpc.call("loadWireframe", { threadId, name, locale });
      const next = parseWireframe(loaded.json);
      commit(next);
      setOpenedStem(name);
      setSelected([]);
      setEdit(null);
      setOpenTabIds([getActivePage(next).id]);
      setOpenOpen(false);
      toast.success(t("protoOpened", { name }));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (el: WireframeElement, next: InlineEdit) => {
    setSelected([el.id]);
    setEdit(next);
  };

  const applyEdit = (current: InlineEdit, elements: WireframeElement[]): WireframeElement[] => {
    return elements.map((el) => (el.id === current.id && !draftUnchanged(el, current) ? applyInlineDraft(el, current) : el));
  };

  const closeEdit = (next: InlineEdit | null = null) => {
    skipBlur.current = true;
    setEdit(next);
    requestAnimationFrame(() => {
      skipBlur.current = false;
    });
  };

  const commitEdit = () => {
    const current = editRef.current;
    if (!current) return;
    const el = pageElements(doc).find((item) => item.id === current.id);
    if (!el || draftUnchanged(el, current)) {
      closeEdit(null);
      return;
    }
    replace(applyEdit(current, pageElements(doc)));
    closeEdit(null);
  };

  const onInlineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const current = editRef.current;
    if (!current) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeEdit(null);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const el = pageElements(doc).find((item) => item.id === current.id);
      if (!el) {
        closeEdit(null);
        return;
      }
      if (el.type === "Radio" || el.type === "Checkbox") {
        const result = addChoiceSibling(applyEdit(current, pageElements(doc)), el.id, current.draft);
        replace(result.elements);
        closeEdit(result.edit);
        setSelected([result.edit.id]);
        return;
      }
      if (current.target.kind === "item") {
        const result = enterOnListItem(applyInlineDraft(el, current), current.target.key, current.target.index, current.draft);
        replace(pageElements(doc).map((item) => (item.id === el.id ? result.element : item)));
        closeEdit({ id: el.id, target: { kind: "item", key: current.target.key, index: result.nextIndex }, draft: "" });
        return;
      }
      commitEdit();
      return;
    }
    if (event.key === "Backspace" && current.target.kind === "item" && current.draft === "") {
      event.preventDefault();
      const el = pageElements(doc).find((item) => item.id === current.id);
      if (!el) return;
      const result = removeEmptyListItem(el, current.target.key, current.target.index);
      replace(pageElements(doc).map((item) => (item.id === el.id ? result.element : item)));
      if (result.nextIndex === null) closeEdit(null);
      else closeEdit({ id: el.id, target: { kind: "item", key: current.target.key, index: result.nextIndex }, draft: readDraft(result.element, { kind: "item", key: current.target.key, index: result.nextIndex }) });
    }
  };

  const onBoardDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const id = (event.target as HTMLElement).closest("[data-el]")?.getAttribute("data-el");
    const el = pageElements(view).find((item) => item.id === id);
    if (!el) return;
    event.preventDefault();
    const localX = boardPoint(event).x - el.x;
    const localY = boardPoint(event).y - el.y;
    const listKey = itemListKey(el.type);
    if (listKey) {
      const index = itemIndexAt(el, localX, localY);
      beginEdit(el, { id: el.id, target: { kind: "item", key: listKey, index }, draft: readDraft(el, { kind: "item", key: listKey, index }) });
      return;
    }
    const key = simpleEditKey(el.type);
    if (key) beginEdit(el, { id: el.id, target: { kind: "prop", key }, draft: readDraft(el, { kind: "prop", key }) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (edit || (event.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (mod && key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && key === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (mod && key === "d") {
      event.preventDefault();
      duplicateSelected();
      return;
    }
    if (mod && key === "c") {
      event.preventDefault();
      copySelected();
      return;
    }
    if (mod && key === "v") {
      event.preventDefault();
      paste();
      return;
    }
    if (mod && key === "x") {
      event.preventDefault();
      cutSelected();
      return;
    }
    if (mod && key === "g") {
      event.preventDefault();
      if (event.shiftKey) ungroupSelected();
      else groupSelected();
      return;
    }
    if (mod && key === "l") {
      event.preventDefault();
      toggleLockSelected();
      return;
    }
    if (mod && key === "h") {
      event.preventDefault();
      if (event.shiftKey) setHiddenSelected(false);
      else setHiddenSelected(true);
      return;
    }
    if (mod && key === "a") {
      event.preventDefault();
      setSelected(pageElements(doc).map((el) => el.id));
      return;
    }
    if (mod && key === "s") {
      event.preventDefault();
      setSaveName(openedStem ?? doc.name);
      setSaveOpen(true);
      return;
    }
    if (mod && (key === "=" || key === "+")) {
      event.preventDefault();
      setZoom((z) => zoomIn(z));
      return;
    }
    if (mod && key === "-") {
      event.preventDefault();
      setZoom((z) => zoomOut(z));
      return;
    }
    if (mod && key === "0") {
      event.preventDefault();
      fitZoom();
      return;
    }
    if (mod && key === "1") {
      event.preventDefault();
      setZoom(1);
      return;
    }
    if (mod && key === "2" && event.shiftKey) {
      event.preventDefault();
      zoomSelection();
      return;
    }
    if (mod && key === "2") {
      event.preventDefault();
      setZoom(2);
      return;
    }
    if (mod && event.altKey && event.key === "'") {
      event.preventDefault();
      patchStudioSettings({ protoGridStep: settings.protoGridStep === 5 ? 8 : 5 });
      return;
    }
    if (mod && event.key === "'") {
      event.preventDefault();
      patchStudioSettings({ protoSnap: !snapGrid });
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected();
      return;
    }
    if (event.key.startsWith("Arrow") && selected.length) {
      event.preventDefault();
      const step = nudgeStep(event.shiftKey);
      const { dx, dy } = arrowNudge(event.key, step);
      if (mod && one) {
        replace(pageElements(doc).map((el) => (el.id === one.id ? resizeByArrow(el, event.key, step) : el)));
        return;
      }
      replace(pageElements(doc).map((el) => (selected.includes(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el)));
      return;
    }
    if (event.key === "Escape") {
      if (drag.current) {
        event.preventDefault();
        cancelActiveDrag();
        return;
      }
      if (pendingTool) {
        event.preventDefault();
        setPendingTool(null);
        return;
      }
    }
    if (event.key === "?" || (event.shiftKey && event.key === "/")) {
      event.preventDefault();
      setShortcutsOpen(true);
      return;
    }
    if (quickInsertOpen && event.key === "Escape") {
      event.preventDefault();
      setQuickInsertOpen(false);
      setQuickQuery("");
      return;
    }
    if (!mod && key === "/") {
      event.preventDefault();
      setQuickInsertOpen(true);
      return;
    }
    if (!mod && key === "v") {
      setPendingTool(null);
      return;
    }
    if (!mod && key.length === 1 && CANVAS_TOOL_KEYS[key]) {
      event.preventDefault();
      setPendingTool(CANVAS_TOOL_KEYS[key]);
      setQuickInsertOpen(false);
    }
  };

  
  const activePage = getActivePage(view);
  const openTabs = doc.pages.filter((p) => openTabIds.includes(p.id));
  const selectionBand = useMemo(() => {
    const b = selectionBounds(pageElements(view), selected);
    return b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : null;
  }, [view, selected]);

  const switchPage = (pageId: string) => {
    commit(setActivePageId(doc, pageId));
    setOpenTabIds((ids) => (ids.includes(pageId) ? ids : [...ids, pageId]));
    setSelected([]);
    setEdit(null);
  };

  const addPage = () => {
    const page = newPage(nextPageName(doc.pages));
    commit({ ...doc, pages: [...doc.pages, page], activePageId: page.id });
    setOpenTabIds((ids) => [...ids, page.id]);
    setSelected([]);
  };

  const duplicatePage = (pageId: string) => {
    const source = doc.pages.find((p) => p.id === pageId);
    if (!source) return;
    const copy = { ...structuredClone(source), id: newPage().id, name: nextPageName(doc.pages) };
    commit({ ...doc, pages: [...doc.pages, copy], activePageId: copy.id });
    setOpenTabIds((ids) => [...ids, copy.id]);
  };

  const deletePage = (pageId: string) => {
    if (doc.pages.length <= 1) return;
    const pages = doc.pages.filter((p) => p.id !== pageId);
    const nextActive = pageId === doc.activePageId ? pages[0]!.id : doc.activePageId;
    commit({ ...doc, pages, activePageId: nextActive });
    setOpenTabIds((ids) => ids.filter((id) => id !== pageId));
  };

  const renamePage = (pageId: string, name: string) => {
    commit({ ...doc, pages: doc.pages.map((p) => (p.id === pageId ? { ...p, name } : p)) });
  };

  const reorderPages = (from: number, to: number) => {
    const pages = [...doc.pages];
    const [item] = pages.splice(from, 1);
    pages.splice(to, 0, item!);
    commit({ ...doc, pages });
  };

  const reorderElements = (from: number, to: number) => {
    const els = [...pageElements(doc)];
    const [item] = els.splice(from, 1);
    els.splice(to, 0, item!);
    replace(els);
  };

  const toggleHidden = (id: string) => replace(pageElements(doc).map((el) => (el.id === id ? { ...el, hidden: !el.hidden } : el)));
  const toggleLocked = (id: string) => replace(pageElements(doc).map((el) => (el.id === id ? { ...el, locked: !el.locked } : el)));
  const renameElement = (id: string, label: string) => replace(pageElements(doc).map((el) => (el.id === id ? { ...el, label } : el)));

  const updatePageNotes = (notes: string) => commit(updateActivePage(doc, (p) => ({ ...p, notes: notes || undefined })));

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!event.altKey || !(event.metaKey || event.ctrlKey)) return;
      if (event.key === "[") { event.preventDefault(); setLeftOpen((o) => !o); }
      if (event.key === "]") { event.preventDefault(); setRightOpen((o) => !o); }
      if (event.key === "Enter" && leftTab === "pages") { event.preventDefault(); addPage(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leftTab, doc]);

  useEffect(() => {
    const block = (event: globalThis.KeyboardEvent) => {
      const tag = (event.target as HTMLElement).closest("input, textarea, [role=dialog]");
      if (tag) return;
      if (event.code === "Space") {
        event.preventDefault();
        spaceHeld.current = event.type === "keydown";
        setModifiers((m) => ({ ...m, space: event.type === "keydown" }));
      }
    };
    window.addEventListener("keydown", block);
    window.addEventListener("keyup", block);
    return () => {
      window.removeEventListener("keydown", block);
      window.removeEventListener("keyup", block);
    };
  }, []);

  useEffect(() => {
    const sync = (event: globalThis.KeyboardEvent) => {
      const tag = (event.target as HTMLElement).closest("input, textarea, [role=dialog]");
      if (tag) return;
      setModifiers((m) => ({
        ...m,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey || event.ctrlKey,
      }));
    };
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
    };
  }, []);

  const modifierHint = useMemo(() => {
    const labels = activeModifierLabels(modifiers);
    if (!labels.length) return null;
    const text: Record<(typeof labels)[number], string> = {
      shift: t("protoModifierShift"),
      alt: t("protoModifierAlt"),
      meta: t("protoModifierMeta"),
      space: t("protoModifierSpace"),
    };
    return labels.map((label) => text[label]).join(" · ");
  }, [modifiers, t]);

const filtered = PALETTE_TILES.filter((tile) => tileMatchesQuery(tile, query, t(tile.labelKey, tile.labelParams ?? {})));
  const quickTiles = PALETTE_TILES.filter((tile) => tileMatchesQuery(tile, quickQuery, t(tile.labelKey, tile.labelParams ?? {}))).slice(0, 12);
  const canGroup = selected.length > 1;
  const canUngroup = selected.some((id) => pageElements(doc).find((el) => el.id === id)?.groupId);
  const selectionLocked = selected.length > 0 && selected.every((id) => pageElements(doc).find((el) => el.id === id)?.locked);
  const selectionHidden = selected.length > 0 && selected.every((id) => pageElements(doc).find((el) => el.id === id)?.hidden);

  return (
    <div ref={rootRef} tabIndex={0} data-thread-id={threadId} className="h-full min-h-0 outline-none" onKeyDown={onKeyDown}>
      <PrototypeShell
        shellRef={shellRef}
        compact={compact}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        leftOverlay={leftOverlay}
        rightOverlay={rightOverlay}
        setLeftOverlay={setLeftOverlay}
        setRightOverlay={setRightOverlay}
        toolbar={
          <PrototypeToolbar
            barRef={barRef}
            menu={menu}
            toggleMenu={toggleMenu}
            nameDraft={nameDraft}
            setNameDraft={setNameDraft}
            commitName={commitName}
            index={index}
            historyLength={history.length}
            undo={undo}
            redo={redo}
            selectedCount={selected.length}
            duplicateSelected={duplicateSelected}
            removeSelected={removeSelected}
            nudgeLayer={nudgeLayer}
            narrow={compact}
            applyAlign={applyAlign}
            applyDistribute={applyDistribute}
            zoom={zoom}
            setZoom={setZoom}
            fitZoom={fitZoom}
            badges={badges}
            setBadges={(fn) => patchStudioSettings({ protoBadges: fn(badges) })}
            busy={busy}
            sendToChat={sendToChat}
            onNew={() => { const next = blankWireframe(); commit(next); setOpenedStem(null); setSelected([]); setEdit(null); setOpenTabIds([getActivePage(next).id]); }}
            onOpen={() => { setOpenOpen(true); void loadList(); }}
            onSave={() => { setSaveName(openedStem ?? doc.name); setSaveOpen(true); }}
            toggleLeftPane={() => setLeftOpen((o) => !o)}
            toggleRightPane={() => setRightOpen((o) => !o)}
            autosaveStatus={autosaveStatus}
          />
        }
        styleBar={<PrototypeStyleBar inspect={inspect} canvas={pageCanvas(doc)} onCanvas={(patch) => commit(patchCanvas(doc, patch))} onUpdate={updateOne} />}
        leftPane={
          <PrototypeLeftPane
            topTab={leftTab}
            setTopTab={setLeftTab}
            pages={doc.pages}
            activePageId={doc.activePageId}
            onSelectPage={switchPage}
            onAddPage={addPage}
            onDuplicatePage={duplicatePage}
            onDeletePage={deletePage}
            onRenamePage={renamePage}
            onReorderPages={reorderPages}
            elements={pageElements(doc)}
            selected={selected}
            onSelectElement={(id) => setSelected([id])}
            onToggleHidden={toggleHidden}
            onToggleLocked={toggleLocked}
            onReorderElements={reorderElements}
            onRenameElement={renameElement}
            paletteView={paletteView}
            setPaletteView={setPaletteView}
            query={query}
            setQuery={setQuery}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            filteredTiles={filtered}
            onAddTile={(tile) => addTile(tile)}
            onAddTemplate={(templateId) => addTemplate(templateId)}
            onAddIcon={(name) => addIconFromLibrary(name)}
          />
        }
        canvas={
          <PrototypeCanvas
            canvasPaneRef={canvasPaneRef}
            boardRef={boardRef}
            openTabs={openTabs}
            activePageId={doc.activePageId}
            onSelectPage={switchPage}
            onCloseTab={(id) => setOpenTabIds((tabs) => tabs.filter((t) => t !== id))}
            canvas={pageCanvas(view)}
            elements={pageElements(view)}
            zoom={zoom}
            badges={badges}
            notes={notes}
            selected={selected}
            one={one}
            edit={edit}
            editInputRef={editInputRef}
            selectionBand={selectionBand}
            showSnapGrid={settings.protoShowGrid}
            gridSize={settings.protoGridStep}
            marquee={marquee}
            snapGuides={snapGuides}
            distanceLines={distanceLines}
            moveTooltip={moveTooltip}
            panning={panning}
            insertMode={pendingTool !== null}
            drawPreview={drawPreview}
            modifierHint={modifierHint}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onPanePointerDown={onPanePointerDown}
            onPanePointerMove={onPanePointerMove}
            onPanePointerUp={onPanePointerUp}
            onBoardPointerDown={onBoardPointerDown}
            onBoardPointerMove={onBoardPointerMove}
            onBoardPointerUp={onBoardPointerUp}
            onBoardDoubleClick={onBoardDoubleClick}
            onBoardContextMenu={onBoardContextMenu}
            onDrop={onDrop}
            onEditChange={(draft) => setEdit((e) => (e ? { ...e, draft } : e))}
            onInlineKeyDown={onInlineKeyDown}
            onCommitEdit={commitEdit}
            skipBlur={skipBlur}
            onPaneClick={() => setMenu(null)}
          />
        }
        inspector={
          <PrototypeInspector
            tab={inspectorTab}
            setTab={setInspectorTab}
            inspect={inspect}
            selection={selectedEls}
            elements={pageElements(doc)}
            canvas={pageCanvas(doc)}
            pageNotes={activePage.notes ?? ""}
            noteMarkers={badges}
            onNoteMarkers={(on) => patchStudioSettings({ protoBadges: on })}
            onPageNotes={updatePageNotes}
            onCanvas={(patch) => commit(patchCanvas(doc, patch))}
            updateOne={updateOne}
            updateMany={updateMany}
            setProp={setProp}
            onReplaceElement={replaceElement}
            onRadioGroup={(groupId) => {
              if (!one) return;
              if (groupId === "__create__") {
                replace(createRadioGroup(pageElements(doc), [one.id]));
                return;
              }
              replace(assignRadioGroup(pageElements(doc), one.id, groupId));
            }}
            onRadioChecked={(checked) => {
              if (!one) return;
              replace(setRadioChecked(pageElements(doc), one.id, checked));
            }}
            applyAlign={applyAlign}
            applyDistribute={applyDistribute}
          />
        }
        dialogs={
          <>
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("save")}</DialogTitle></DialogHeader>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs text-muted-foreground">{t("fileName")}</span>
                  <Input value={saveName} onChange={(event) => setSaveName(event.target.value.replace(/[/\\]/g, ""))} />
                </label>
                <DialogFooter className="flex-wrap gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => setSaveOpen(false)}>{t("cancel")}</Button>
                  {openedStem ? <Button variant="outline" disabled={busy} onClick={() => void save(true)}>{t("protoOverwrite")}</Button> : null}
                  <Button disabled={busy || !saveName.trim()} onClick={() => void save(false)}>{t("save")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={openOpen} onOpenChange={setOpenOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("protoOpen")}</DialogTitle></DialogHeader>
                {savedNames.length === 0 ? <div className="text-sm text-muted-foreground">{t("protoNoSaved")}</div> : (
                  <div className="flex max-h-64 flex-col gap-1 overflow-auto">
                    {savedNames.map((name) => (
                      <button key={name} type="button" className="rounded-md border border-border px-2 py-1.5 text-left text-sm hover:bg-state-hover" onClick={() => void loadOne(name)}>{name}</button>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <ProtoShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <PrototypeContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        canPaste={clipboard.current.length > 0}
        canGroup={canGroup}
        canUngroup={canUngroup}
        locked={selectionLocked}
        hidden={selectionHidden}
        onAction={onContextAction}
        onClose={() => setContextMenu(null)}
      />
      {quickInsertOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/20 pt-24" onClick={() => { setQuickInsertOpen(false); setQuickQuery(""); }}>
          <div className="w-full max-w-md rounded-lg border border-border bg-popover p-3 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 text-sm font-medium">{t("protoQuickInsert")}</div>
            <Input autoFocus value={quickQuery} onChange={(event) => setQuickQuery(event.target.value)} placeholder={t("protoSearch")} />
            <div className="mt-2 max-h-64 overflow-auto">
              {quickTiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className="flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-state-hover"
                  onClick={() => {
                    addTile(tile);
                    setQuickInsertOpen(false);
                    setQuickQuery("");
                  }}
                >
                  {t(tile.labelKey, tile.labelParams ?? {})}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}