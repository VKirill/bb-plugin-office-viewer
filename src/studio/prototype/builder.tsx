import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useComposer, useRpc } from "@get-bb/plugin-sdk/app";
import type { domToBlob } from "modern-screenshot";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { rpcContract } from "../../../server";
import { SCREENSHOT_LIBRARY } from "../../html/capture";
import { detectLocale, t, type I18nKey } from "../../shared/i18n";
import { ElementFace } from "./elements";
import {
  CATALOG_BY_TYPE,
  CANVAS_PRESETS,
  SNAP,
  cloneWireframe,
  newElementId,
  newWireframe,
  parseWireframe,
  snap,
  type ElementType,
  type PaletteGroup,
  type PropValue,
  type Wireframe,
  type WireframeElement,
} from "./model";
import { PALETTE_BY_ID, PALETTE_TILES, elementFromTile, previewElement, tileGroup, tileMatchesQuery, type PaletteTile } from "./palette";
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
  type InlineTarget,
} from "./editing";
import { alignElements, distributeElements, type AlignEdge, type DistributeAxis } from "./align";

const MAX_HISTORY = 60;
const MIN_SIZE = SNAP;
const HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type Handle = (typeof HANDLES)[number];
type SendKind = "both" | "png" | "json";
type ToolbarMenu = "file" | "send" | "zoom" | "more";
const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const DEVICE_ICON: Record<keyof typeof CANVAS_PRESETS, IconName> = {
  desktop: "Laptop",
  tablet: "AppWindow",
  phone: "Smartphone",
};
const DEVICE_LABEL: Record<keyof typeof CANVAS_PRESETS, I18nKey> = {
  desktop: "protoDesktop",
  tablet: "protoTablet",
  phone: "protoPhone",
};
const ALIGN_TOOLS: { kind: AlignEdge; label: I18nKey }[] = [
  { kind: "left", label: "protoAlignLeft" },
  { kind: "center", label: "protoAlignCenter" },
  { kind: "right", label: "protoAlignRight" },
  { kind: "top", label: "protoAlignTop" },
  { kind: "middle", label: "protoAlignMiddle" },
  { kind: "bottom", label: "protoAlignBottom" },
];
type FieldKind = "text" | "textarea" | "number" | "boolean" | "list" | "select";
type Field = { key: string; kind: FieldKind; label: I18nKey; options?: string[] };

const GROUPS: { id: PaletteGroup; label: I18nKey }[] = [
  { id: "layout", label: "protoGroupLayout" },
  { id: "inputs", label: "protoGroupInputs" },
  { id: "content", label: "protoGroupContent" },
  { id: "navigation", label: "protoGroupNavigation" },
];

const FIELDS: Partial<Record<ElementType, Field[]>> = {
  Header: [{ key: "text", kind: "text", label: "protoPropText" }],
  Nav: [{ key: "items", kind: "list", label: "protoPropItems" }],
  Text: [{ key: "text", kind: "textarea", label: "protoPropText" }],
  Heading: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "level", kind: "number", label: "protoPropLevel" },
  ],
  Button: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "variant", kind: "select", label: "protoPropVariant", options: ["default", "secondary", "outline", "ghost", "destructive"] },
  ],
  TextField: [
    { key: "placeholder", kind: "text", label: "protoPropPlaceholder" },
    { key: "value", kind: "text", label: "protoPropValue" },
  ],
  TextArea: [
    { key: "placeholder", kind: "text", label: "protoPropPlaceholder" },
    { key: "value", kind: "textarea", label: "protoPropValue" },
  ],
  ChoicePicker: [
    { key: "options", kind: "list", label: "protoPropOptions" },
    { key: "value", kind: "text", label: "protoPropValue" },
  ],
  Checkbox: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "checked", kind: "boolean", label: "protoPropChecked" },
  ],
  Radio: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "checked", kind: "boolean", label: "protoPropChecked" },
  ],
  Switch: [
    { key: "text", kind: "text", label: "protoPropText" },
    { key: "checked", kind: "boolean", label: "protoPropChecked" },
  ],
  Slider: [
    { key: "value", kind: "number", label: "protoPropValue" },
    { key: "min", kind: "number", label: "protoPropMin" },
    { key: "max", kind: "number", label: "protoPropMax" },
  ],
  Card: [
    { key: "title", kind: "text", label: "protoPropTitle" },
    { key: "text", kind: "textarea", label: "protoPropText" },
  ],
  Image: [{ key: "alt", kind: "text", label: "protoPropAlt" }],
  Avatar: [{ key: "initials", kind: "text", label: "protoPropInitials" }],
  Icon: [{ key: "name", kind: "text", label: "protoPropName" }],
  Badge: [{ key: "text", kind: "text", label: "protoPropText" }],
  Table: [
    { key: "columns", kind: "number", label: "protoPropColumns" },
    { key: "rows", kind: "number", label: "protoPropRows" },
  ],
  List: [{ key: "items", kind: "list", label: "protoPropItems" }],
  Tabs: [
    { key: "items", kind: "list", label: "protoPropItems" },
    { key: "active", kind: "text", label: "protoPropActive" },
  ],
  Modal: [
    { key: "title", kind: "text", label: "protoPropTitle" },
    { key: "text", kind: "textarea", label: "protoPropText" },
  ],
};

const HANDLE_CLASS: Record<Handle, string> = {
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-n-resize",
  s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-s-resize",
  e: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-e-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-w-resize",
  ne: "right-0 top-0 -translate-y-1/2 translate-x-1/2 cursor-ne-resize",
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize",
  se: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-se-resize",
  sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize",
};

type Drag =
  | { kind: "move"; ids: string[]; ox: number; oy: number; orig: Record<string, { x: number; y: number }> }
  | { kind: "resize"; id: string; handle: Handle; orig: WireframeElement };

type Library = { domToBlob: typeof domToBlob };
let library: Promise<Library> | null = null;

function loadLibrary() {
  const scope = globalThis as { modernScreenshot?: Library };
  library ??= new Promise<Library>((resolve, reject) => {
    if (scope.modernScreenshot) return resolve(scope.modernScreenshot);
    const script = document.createElement("script");
    script.src = SCREENSHOT_LIBRARY;
    script.onload = () => (scope.modernScreenshot ? resolve(scope.modernScreenshot) : reject(new Error("modern-screenshot did not load")));
    script.onerror = () => reject(new Error("modern-screenshot did not load"));
    document.head.append(script);
  });
  library.catch(() => {
    library = null;
  });
  return library;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function resized(el: WireframeElement, handle: Handle, x: number, y: number): WireframeElement {
  let left = el.x;
  let top = el.y;
  let right = el.x + el.w;
  let bottom = el.y + el.h;
  if (handle.includes("w")) left = Math.min(snap(x), right - MIN_SIZE);
  if (handle.includes("e")) right = Math.max(snap(x), left + MIN_SIZE);
  if (handle.includes("n")) top = Math.min(snap(y), bottom - MIN_SIZE);
  if (handle.includes("s")) bottom = Math.max(snap(y), top + MIN_SIZE);
  return { ...el, x: left, y: top, w: Math.max(MIN_SIZE, snap(right - left)), h: Math.max(MIN_SIZE, snap(bottom - top)) };
}

function placeOnCanvas(el: WireframeElement, canvas: Wireframe["canvas"]): WireframeElement {
  const w = Math.min(el.w, canvas.width);
  const h = Math.min(el.h, canvas.height);
  return {
    ...el,
    w,
    h,
    x: snap(Math.max(0, Math.min(el.x, canvas.width - w))),
    y: snap(Math.max(0, Math.min(el.y, canvas.height - h))),
  };
}

function editOverlayBox(el: WireframeElement, target: InlineTarget): { left: number; top: number; width: number; height: number } {
  if (target.kind === "item") {
    if (el.type === "List") {
      const n = Math.max(1, stringList(el, "items").length);
      const h = el.h / n;
      return { left: 16, top: target.index * h, width: Math.max(8, el.w - 20), height: h };
    }
    if (el.type === "Nav" || el.type === "Tabs") {
      const n = Math.max(1, stringList(el, target.key).length);
      const w = el.w / n;
      return { left: target.index * w, top: 0, width: w, height: el.h };
    }
    return { left: 8, top: 4, width: Math.max(8, el.w - 32), height: Math.max(8, el.h - 8) };
  }
  if (el.type === "Radio" || el.type === "Checkbox") {
    return { left: 24, top: 2, width: Math.max(8, el.w - 28), height: Math.max(8, el.h - 4) };
  }
  if (el.type === "Card" || el.type === "Modal") {
    return { left: 10, top: 8, width: Math.max(8, el.w - 20), height: 24 };
  }
  if (el.type === "Header") {
    return { left: 16, top: 8, width: Math.max(8, el.w - 32), height: Math.max(8, el.h - 16) };
  }
  return { left: 4, top: 4, width: Math.max(8, el.w - 8), height: Math.max(8, el.h - 8) };
}

function noteNumbers(elements: readonly WireframeElement[]): Map<string, number> {
  const map = new Map<string, number>();
  let n = 0;
  for (const el of elements) {
    if (el.note?.trim()) map.set(el.id, ++n);
  }
  return map;
}

export function PrototypeBuilder({ threadId }: { threadId: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const composer = useComposer();
  const locale = detectLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const canvasPaneRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const clipboard = useRef<WireframeElement[]>([]);
  const [{ history, index }, setTimeline] = useState(() => ({ history: [newWireframe()], index: 0 }));
  const doc = history[index]!;
  const [live, setLive] = useState<Wireframe | null>(null);
  const view = live ?? doc;
  const [selected, setSelected] = useState<string[]>([]);
  const [badges, setBadges] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Partial<Record<PaletteGroup, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [menu, setMenu] = useState<ToolbarMenu | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [openedStem, setOpenedStem] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("Untitled");
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
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setNarrow((entries[0]?.contentRect.width ?? el.clientWidth) < 720);
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

  const replace = (elements: WireframeElement[]) => commit({ ...doc, elements });

  const addTile = (tile: PaletteTile, x?: number, y?: number) => {
    const spec = CATALOG_BY_TYPE[tile.type];
    const el = placeOnCanvas(
      elementFromTile(tile, x ?? (doc.canvas.width - spec.w) / 2, y ?? (doc.canvas.height - spec.h) / 2, doc.elements),
      doc.canvas,
    );
    replace([...doc.elements, el]);
    setSelected([el.id]);
  };

  const selectedEls = view.elements.filter((el) => selected.includes(el.id));
  const one = selectedEls.length === 1 ? selectedEls[0] : null;
  const inspect = one && edit?.id === one.id ? applyInlineDraft(one, edit) : one;
  const notes = useMemo(() => noteNumbers(view.elements), [view.elements]);

  const updateOne = (patch: Partial<WireframeElement>) => {
    if (!one) return;
    replace(doc.elements.map((el) => (el.id === one.id ? { ...el, ...patch } : el)));
  };

  const setProp = (key: string, value: PropValue) => {
    if (!one) return;
    if (one.type === "Radio" && key === "checked") {
      const next = doc.elements.map((el) => (el.id === one.id ? { ...el, props: { ...el.props, checked: value } } : el));
      replace(value === true ? checkRadio(next, one.id) : next);
      return;
    }
    updateOne({ props: { ...one.props, [key]: value } });
  };

  const removeSelected = () => {
    if (!selected.length) return;
    replace(doc.elements.filter((el) => !selected.includes(el.id)));
    setSelected([]);
  };

  const duplicateSelected = () => {
    if (!selected.length) return;
    const copies = doc.elements
      .filter((el) => selected.includes(el.id))
      .map((el) => placeOnCanvas({ ...structuredClone(el), id: newElementId(), x: el.x + SNAP * 2, y: el.y + SNAP * 2 }, doc.canvas));
    replace([...doc.elements, ...copies]);
    setSelected(copies.map((el) => el.id));
  };

  const copySelected = () => {
    clipboard.current = selectedEls.map((el) => structuredClone(el));
  };

  const paste = () => {
    if (!clipboard.current.length) return;
    const copies = clipboard.current.map((el) =>
      placeOnCanvas({ ...structuredClone(el), id: newElementId(), x: el.x + SNAP * 2, y: el.y + SNAP * 2 }, doc.canvas),
    );
    clipboard.current = copies;
    replace([...doc.elements, ...copies]);
    setSelected(copies.map((el) => el.id));
  };

  const commitName = () => {
    const name = nameDraft.trim() || "Untitled";
    setNameDraft(name);
    if (name !== doc.name) commit({ ...doc, name });
  };

  const applyAlign = (edge: AlignEdge) => {
    if (!selected.length) return;
    replace(alignElements(doc.elements, selected, edge, doc.canvas));
  };

  const applyDistribute = (axis: DistributeAxis) => {
    if (selected.length < 3) return;
    replace(distributeElements(doc.elements, selected, axis));
  };

  const fitZoom = () => {
    const pane = canvasPaneRef.current;
    if (!pane) return;
    const pad = 32;
    const next = Math.min((pane.clientWidth - pad) / doc.canvas.width, (pane.clientHeight - pad) / doc.canvas.height);
    setZoom(Math.max(0.25, Math.min(2, Math.round(next * 100) / 100)));
  };

  const toggleMenu = (id: ToolbarMenu) => setMenu((was) => (was === id ? null : id));

  const nudgeLayer = (delta: 1 | -1) => {
    if (!selected.length) return;
    const next = [...doc.elements];
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

  const onBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("input")) return;
    const handle = (event.target as HTMLElement).dataset.handle as Handle | undefined;
    const id = (event.target as HTMLElement).closest("[data-el]")?.getAttribute("data-el");
    const p = boardPoint(event);
    if (handle && one) {
      drag.current = { kind: "resize", id: one.id, handle, orig: { ...one, props: { ...one.props } } };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (id) {
      const ids = event.shiftKey ? (selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]) : selected.includes(id) ? selected : [id];
      setSelected(ids);
      const orig: Record<string, { x: number; y: number }> = {};
      for (const el of view.elements) if (ids.includes(el.id)) orig[el.id] = { x: el.x, y: el.y };
      drag.current = { kind: "move", ids, ox: p.x, oy: p.y, orig };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (!event.shiftKey) setSelected([]);
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const p = boardPoint(event);
    if (current.kind === "move") {
      const dx = snap(p.x - current.ox);
      const dy = snap(p.y - current.oy);
      setLive({
        ...doc,
        elements: doc.elements.map((el) => {
          const from = current.orig[el.id];
          return from ? { ...el, x: from.x + dx, y: from.y + dy } : el;
        }),
      });
      return;
    }
    setLive({
      ...doc,
      elements: doc.elements.map((el) => (el.id === current.id ? resized(current.orig, current.handle, p.x, p.y) : el)),
    });
  };

  const onBoardPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    if (current?.kind === "move") {
      const p = boardPoint(event);
      if (snap(p.x - current.ox) === 0 && snap(p.y - current.oy) === 0) {
        const el = doc.elements.find((item) => current.ids[0] === item.id);
        if (el && event.detail === 1 && (el.type === "Radio" || el.type === "Checkbox") && p.x - el.x < 28) {
          setLive(null);
          replace(el.type === "Radio" ? checkRadio(doc.elements, el.id) : toggleCheckbox(doc.elements, el.id));
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

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const tile = PALETTE_BY_ID[event.dataTransfer.getData("text/plain")];
    if (!tile) return;
    const p = boardPoint(event);
    const spec = CATALOG_BY_TYPE[tile.type];
    addTile(tile, p.x - spec.w / 2, p.y - spec.h / 2);
  };

  const capturePng = async () => {
    const node = boardRef.current;
    if (!node) throw new Error(t("protoCaptureFailed"));
    const lib = await loadLibrary();
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
    const el = doc.elements.find((item) => item.id === current.id);
    if (!el || draftUnchanged(el, current)) {
      closeEdit(null);
      return;
    }
    replace(applyEdit(current, doc.elements));
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
      const el = doc.elements.find((item) => item.id === current.id);
      if (!el) {
        closeEdit(null);
        return;
      }
      if (el.type === "Radio" || el.type === "Checkbox") {
        const result = addChoiceSibling(applyEdit(current, doc.elements), el.id, current.draft);
        replace(result.elements);
        closeEdit(result.edit);
        setSelected([result.edit.id]);
        return;
      }
      if (current.target.kind === "item") {
        const result = enterOnListItem(applyInlineDraft(el, current), current.target.key, current.target.index, current.draft);
        replace(doc.elements.map((item) => (item.id === el.id ? result.element : item)));
        closeEdit({ id: el.id, target: { kind: "item", key: current.target.key, index: result.nextIndex }, draft: "" });
        return;
      }
      commitEdit();
      return;
    }
    if (event.key === "Backspace" && current.target.kind === "item" && current.draft === "") {
      event.preventDefault();
      const el = doc.elements.find((item) => item.id === current.id);
      if (!el) return;
      const result = removeEmptyListItem(el, current.target.key, current.target.index);
      replace(doc.elements.map((item) => (item.id === el.id ? result.element : item)));
      if (result.nextIndex === null) closeEdit(null);
      else closeEdit({ id: el.id, target: { kind: "item", key: current.target.key, index: result.nextIndex }, draft: readDraft(result.element, { kind: "item", key: current.target.key, index: result.nextIndex }) });
    }
  };

  const onBoardDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const id = (event.target as HTMLElement).closest("[data-el]")?.getAttribute("data-el");
    const el = view.elements.find((item) => item.id === id);
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
    if (mod && key === "s") {
      event.preventDefault();
      setSaveName(openedStem ?? doc.name);
      setSaveOpen(true);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected();
      return;
    }
    if (event.key.startsWith("Arrow") && selected.length) {
      event.preventDefault();
      const step = event.shiftKey ? SNAP * 2 : SNAP;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      replace(doc.elements.map((el) => (selected.includes(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el)));
    }
  };

  const filtered = PALETTE_TILES.filter((tile) => tileMatchesQuery(tile, query, t(tile.labelKey)));

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-thread-id={threadId}
      className="flex h-full min-h-0 flex-col bg-background outline-none"
      onKeyDown={onKeyDown}
    >
      <div ref={barRef} className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <div className="relative" data-toolbar-menu>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" aria-expanded={menu === "file"} onClick={() => toggleMenu("file")}>
            {t("protoFile")}
            <Icon name="ChevronDown" className="size-3" />
          </Button>
          {menu === "file" ? (
            <div className="absolute left-0 z-30 mt-1 w-44 rounded-md border border-border bg-background p-1 shadow-md">
              <MenuItem onClick={() => { setMenu(null); commit(newWireframe()); setOpenedStem(null); setSelected([]); setEdit(null); }}>
                {t("protoNew")}
              </MenuItem>
              <MenuItem onClick={() => { setMenu(null); setOpenOpen(true); void loadList(); }}>{t("protoOpen")}</MenuItem>
              <MenuItem
                disabled={busy}
                onClick={() => {
                  setMenu(null);
                  setSaveName(openedStem ?? doc.name);
                  setSaveOpen(true);
                }}
              >
                {t("save")}
              </MenuItem>
            </div>
          ) : null}
        </div>
        <Input
          value={nameDraft}
          aria-label={t("protoRename")}
          className="h-8 w-32 min-w-16 max-w-40"
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
        <ToolBtn tip={t("protoUndoTip")} disabled={index === 0} onClick={undo}>
          <Icon name="ArrowTurnBackward" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoRedoTip")} disabled={index >= history.length - 1} onClick={redo}>
          <Icon name="ArrowTurnForward" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoDuplicateTip")} disabled={!selected.length} onClick={duplicateSelected}>
          <Icon name="Copy" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoDeleteTip")} disabled={!selected.length} onClick={removeSelected}>
          <Icon name="Trash2" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoBringForward")} disabled={!selected.length} onClick={() => nudgeLayer(1)}>
          <Icon name="ChevronsUp" className="size-4" />
        </ToolBtn>
        <ToolBtn tip={t("protoSendBackward")} disabled={!selected.length} onClick={() => nudgeLayer(-1)}>
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
                  {ALIGN_TOOLS.map((item) => (
                    <MenuItem key={item.kind} disabled={!selected.length} onClick={() => { setMenu(null); applyAlign(item.kind); }}>
                      <AlignGlyph kind={item.kind} />
                      {t(item.label)}
                    </MenuItem>
                  ))}
                  <MenuItem disabled={selected.length < 3} onClick={() => { setMenu(null); applyDistribute("horizontal"); }}>
                    <AlignGlyph kind="horizontal" />
                    {t("protoDistributeH")}
                  </MenuItem>
                  <MenuItem disabled={selected.length < 3} onClick={() => { setMenu(null); applyDistribute("vertical"); }}>
                    <AlignGlyph kind="vertical" />
                    {t("protoDistributeV")}
                  </MenuItem>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <Sep />
            {ALIGN_TOOLS.map((item) => (
              <ToolBtn key={item.kind} tip={t(item.label)} disabled={!selected.length} onClick={() => applyAlign(item.kind)}>
                <AlignGlyph kind={item.kind} />
              </ToolBtn>
            ))}
            <ToolBtn tip={t("protoDistributeH")} disabled={selected.length < 3} onClick={() => applyDistribute("horizontal")}>
              <AlignGlyph kind="horizontal" />
            </ToolBtn>
            <ToolBtn tip={t("protoDistributeV")} disabled={selected.length < 3} onClick={() => applyDistribute("vertical")}>
              <AlignGlyph kind="vertical" />
            </ToolBtn>
          </>
        )}
        <Sep />
        <div className="flex rounded-md border border-border">
          {(Object.keys(CANVAS_PRESETS) as (keyof typeof CANVAS_PRESETS)[]).map((id) => (
            <ToolBtn
              key={id}
              tip={t(DEVICE_LABEL[id])}
              pressed={doc.canvas.width === CANVAS_PRESETS[id].width && doc.canvas.height === CANVAS_PRESETS[id].height}
              onClick={() => commit({ ...doc, canvas: { ...doc.canvas, ...CANVAS_PRESETS[id] } })}
            >
              <Icon name={DEVICE_ICON[id]} className="size-4" />
            </ToolBtn>
          ))}
        </div>
        <div className="relative" data-toolbar-menu title={t("protoZoomMenu")}>
          <Button type="button" variant="ghost" size="sm" className="h-8 min-w-14 gap-1 tabular-nums" aria-label={t("protoZoomMenu")} aria-expanded={menu === "zoom"} onClick={() => toggleMenu("zoom")}>
            {Math.round(zoom * 100)}%
            <Icon name="ChevronDown" className="size-3" />
          </Button>
          {menu === "zoom" ? (
            <div className="absolute left-0 z-30 mt-1 w-36 rounded-md border border-border bg-background p-1 shadow-md">
              {ZOOM_PRESETS.map((value) => (
                <MenuItem key={value} onClick={() => { setMenu(null); setZoom(value); }}>
                  {Math.round(value * 100)}%
                </MenuItem>
              ))}
              <MenuItem onClick={() => { setMenu(null); fitZoom(); }}>{t("zoomFit")}</MenuItem>
            </div>
          ) : null}
        </div>
        <ToolBtn tip={t("protoBadges")} pressed={badges} onClick={() => setBadges((on) => !on)}>
          <TagGlyph />
        </ToolBtn>
        <div className="relative ml-auto" data-toolbar-menu>
          <Button type="button" variant="default" size="sm" className="h-8 gap-1" disabled={busy} aria-expanded={menu === "send"} onClick={() => toggleMenu("send")}>
            {t("sendToChat")}
            <Icon name="ChevronDown" className="size-3" />
          </Button>
          {menu === "send" ? (
            <div className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-border bg-background p-1 shadow-md">
              <MenuItem onClick={() => void sendToChat("both")}>{t("protoSendBoth")}</MenuItem>
              <MenuItem onClick={() => void sendToChat("png")}>{t("protoSendPng")}</MenuItem>
              <MenuItem onClick={() => void sendToChat("json")}>{t("protoSendJson")}</MenuItem>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-background">
          <div className="border-b border-border p-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">{t("protoPalette")}</div>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("protoSearch")} className="h-8" />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {GROUPS.map((group) => {
              const items = filtered.filter((tile) => tileGroup(tile) === group.id);
              if (!items.length) return null;
              const open = query.trim() ? true : !collapsed[group.id];
              return (
                <div key={group.id} className="mb-3">
                  <button
                    type="button"
                    className="mb-1 flex w-full items-center gap-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                    aria-expanded={open}
                    onClick={() => setCollapsed((was) => ({ ...was, [group.id]: !was[group.id] }))}
                  >
                    <Icon name="ChevronDown" className={cn("size-3 shrink-0 transition-transform", !open && "-rotate-90")} />
                    {t(group.label)}
                  </button>
                  {open ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5">
                      {items.map((tile) => (
                        <PaletteTileButton key={tile.id} tile={tile} onAdd={() => addTile(tile)} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <div ref={canvasPaneRef} className="min-w-0 flex-1 overflow-auto bg-muted/40 p-4" onClick={() => setMenu(null)}>
          <div className="flex min-h-full min-w-full items-start justify-center">
            <div style={{ width: view.canvas.width * zoom, height: view.canvas.height * zoom }}>
            <div
              ref={boardRef}
              role="application"
              aria-label={t("protoCanvas")}
              className="relative shrink-0 shadow-sm"
              style={{
                width: view.canvas.width,
                height: view.canvas.height,
                background: view.canvas.background,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
              onPointerDown={onBoardPointerDown}
              onPointerMove={onBoardPointerMove}
              onPointerUp={onBoardPointerUp}
              onPointerCancel={onBoardPointerUp}
              onDoubleClick={onBoardDoubleClick}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <div
                data-proto-skip
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: "linear-gradient(to right, color-mix(in oklab, var(--border) 35%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 35%, transparent) 1px, transparent 1px)",
                  backgroundSize: `${SNAP}px ${SNAP}px`,
                }}
              />
              {view.elements.length === 0 ? (
                <div data-proto-skip className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">{t("protoEmptyCanvas")}</div>
              ) : null}
              {view.elements.map((el) => {
                const active = selected.includes(el.id);
                const mark = notes.get(el.id);
                return (
                  <div
                    key={el.id}
                    data-el={el.id}
                    className={cn("absolute overflow-visible", active && "z-10")}
                    style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
                  >
                    <div className="size-full overflow-hidden">
                      <ElementFace el={edit?.id === el.id ? applyInlineDraft(el, edit) : el} />
                    </div>
                    {badges ? (
                      <span className="absolute -top-2 left-0 z-10 max-w-[140%] truncate rounded-full bg-foreground px-1.5 py-px text-[10px] leading-4 text-background">
                        {el.type} · {el.label}
                      </span>
                    ) : null}
                    {mark !== undefined ? (
                      <span className="absolute -right-2 -top-2 z-10 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                        {mark}
                      </span>
                    ) : null}
                    {edit?.id === el.id ? (
                      <input
                        ref={editInputRef}
                        data-proto-skip
                        className="absolute z-20 border border-blue-500 bg-background px-1 text-sm outline-none"
                        style={editOverlayBox(el, edit.target)}
                        value={edit.draft}
                        onChange={(event) => setEdit({ ...edit, draft: event.target.value })}
                        onKeyDown={onInlineKeyDown}
                        onPointerDown={(event) => event.stopPropagation()}
                        onBlur={() => {
                          if (!skipBlur.current) commitEdit();
                        }}
                      />
                    ) : null}
                    {active ? (
                      <div data-proto-skip className="pointer-events-none absolute inset-0 border-2 border-blue-500">
                        {one?.id === el.id
                          ? HANDLES.map((handle) => (
                              <span
                                key={handle}
                                data-handle={handle}
                                className={cn("pointer-events-auto absolute size-2.5 rounded-sm border border-blue-500 bg-background", HANDLE_CLASS[handle])}
                              />
                            ))
                          : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>

        <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-auto border-l border-border p-3 text-sm">
          <div className="text-xs font-medium text-muted-foreground">{t("protoInspector")}</div>
          {inspect ? (
            <>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">{t("protoLabel")}</span>
                <Input value={inspect.label} onChange={(event) => updateOne({ label: event.target.value || inspect.type })} />
              </label>
              {(FIELDS[inspect.type] ?? []).map((field) => (
                <FieldEditor key={field.key} field={field} value={inspect.props[field.key]} onChange={(value) => setProp(field.key, value)} />
              ))}
              <div className="grid grid-cols-2 gap-2">
                <NumField label={t("protoX")} value={inspect.x} onChange={(value) => updateOne({ x: snap(value) })} />
                <NumField label={t("protoY")} value={inspect.y} onChange={(value) => updateOne({ y: snap(value) })} />
                <NumField label={t("protoW")} value={inspect.w} onChange={(value) => updateOne({ w: Math.max(MIN_SIZE, snap(value)) })} />
                <NumField label={t("protoH")} value={inspect.h} onChange={(value) => updateOne({ h: Math.max(MIN_SIZE, snap(value)) })} />
              </div>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">{t("protoNote")}</span>
                <Textarea value={inspect.note ?? ""} onChange={(event) => updateOne({ note: event.target.value || undefined })} />
              </label>
            </>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">{t("protoNoSelection")}</div>
              <div className="grid grid-cols-2 gap-2">
                <NumField label={t("protoW")} value={doc.canvas.width} onChange={(value) => commit({ ...doc, canvas: { ...doc.canvas, width: Math.max(SNAP, snap(value)) } })} />
                <NumField label={t("protoH")} value={doc.canvas.height} onChange={(value) => commit({ ...doc, canvas: { ...doc.canvas, height: Math.max(SNAP, snap(value)) } })} />
              </div>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">{t("protoBackground")}</span>
                <Input value={doc.canvas.background} onChange={(event) => commit({ ...doc, canvas: { ...doc.canvas, background: event.target.value || "#ffffff" } })} />
              </label>
            </>
          )}
        </aside>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("save")}</DialogTitle>
          </DialogHeader>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">{t("fileName")}</span>
            <Input value={saveName} onChange={(event) => setSaveName(event.target.value.replace(/[/\\]/g, ""))} />
          </label>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setSaveOpen(false)}>
              {t("cancel")}
            </Button>
            {openedStem ? (
              <Button variant="outline" disabled={busy} onClick={() => void save(true)}>
                {t("protoOverwrite")}
              </Button>
            ) : null}
            <Button disabled={busy || !saveName.trim()} onClick={() => void save(false)}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openOpen} onOpenChange={setOpenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("protoOpen")}</DialogTitle>
          </DialogHeader>
          {savedNames.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("protoNoSaved")}</div>
          ) : (
            <div className="flex max-h-64 flex-col gap-1 overflow-auto">
              {savedNames.map((name) => (
                <button key={name} type="button" className="rounded-md border border-border px-2 py-1.5 text-left text-sm hover:bg-state-hover" onClick={() => void loadOne(name)}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Sep() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

function ToolBtn({
  tip,
  disabled,
  pressed,
  onClick,
  children,
}: {
  tip: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span title={tip} className="inline-flex">
      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={tip} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </span>
  );
}

function MenuItem({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" disabled={disabled} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-state-hover disabled:pointer-events-none disabled:opacity-50" onClick={onClick}>
      {children}
    </button>
  );
}

function AlignGlyph({ kind }: { kind: AlignEdge | DistributeAxis }) {
  const path: Record<AlignEdge | DistributeAxis, string> = {
    left: "M3 3v10 M7 5h6 M7 8h4 M7 11h6",
    center: "M8 3v10 M4 5h8 M5 8h6 M4 11h8",
    right: "M13 3v10 M3 5h6 M5 8h4 M3 11h6",
    top: "M3 3h10 M5 7v6 M8 7v4 M11 7v6",
    middle: "M3 8h10 M5 4v8 M8 5v6 M11 4v8",
    bottom: "M3 13h10 M5 3v6 M8 5v4 M11 3v6",
    horizontal: "M2 8h3 M7 8h2 M11 8h3 M3 5v6 M8 5v6 M13 5v6",
    vertical: "M8 2v3 M8 7v2 M8 11v3 M5 3h6 M5 8h6 M5 13h6",
  };
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
      <path d={path[kind]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TagGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
      <path d="M2.5 8.5 8.5 2.5h5v5L7.5 13.5z M11 5.5h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function PaletteTileButton({ tile, onAdd }: { tile: PaletteTile; onAdd: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const el = previewElement(tile);
  const boxW = 64;
  const boxH = 44;
  const scale = Math.min(boxW / el.w, boxH / el.h, 1);
  return (
    <button
      type="button"
      title={tile.type}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", tile.id);
        if (previewRef.current) event.dataTransfer.setDragImage(previewRef.current, boxW / 2, boxH / 2);
      }}
      onClick={onAdd}
      className="flex cursor-grab flex-col overflow-hidden rounded-md border border-border bg-card text-left text-foreground hover:bg-state-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing"
    >
      <div ref={previewRef} className="flex h-11 items-center justify-center overflow-hidden bg-background">
        <div className="relative" style={{ width: el.w * scale, height: el.h * scale }}>
          <div className="pointer-events-none" style={{ width: el.w, height: el.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <ElementFace el={el} />
          </div>
        </div>
      </div>
      <span className="truncate border-t border-border px-1 py-1 text-[11px] leading-4 text-foreground">{t(tile.labelKey)}</span>
    </button>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function FieldEditor({ field, value, onChange }: { field: Field; value: PropValue | undefined; onChange: (value: PropValue) => void }) {
  if (field.kind === "boolean") {
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        <span>{t(field.label)}</span>
      </label>
    );
  }
  if (field.kind === "number") {
    return <NumField label={t(field.label)} value={typeof value === "number" ? value : 0} onChange={onChange} />;
  }
  if (field.kind === "list") {
    const lines = Array.isArray(value) ? value.join("\n") : "";
    return (
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t(field.label)}</span>
        <Textarea value={lines} onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} />
      </label>
    );
  }
  if (field.kind === "select") {
    return (
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">{t(field.label)}</span>
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          value={typeof value === "string" ? value : field.options?.[0] ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const Tag = field.kind === "textarea" ? Textarea : Input;
  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted-foreground">{t(field.label)}</span>
      <Tag value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
