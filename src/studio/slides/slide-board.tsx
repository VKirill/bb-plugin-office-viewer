import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { PrototypeCanvas } from "../prototype/canvas";
import { PrototypeInspector, type InspectorTab } from "../prototype/inspector";
import {
  CATALOG_BY_TYPE,
  defaultElement,
  type PropValue,
  type WireframeElement,
  type WireframePage,
} from "../prototype/model";
import { PALETTE_BY_ID, PALETTE_TILES, elementFromTile, type PaletteTile } from "../prototype/palette";
import { assignRadioGroup, createRadioGroup, setRadioChecked } from "../prototype/inspector-model";
import { blobToBase64, loadScreenshotLibrary, noteNumbers, placeOnCanvas, resized, selectionBounds, type Handle } from "../prototype/builder-geometry";
import {
  applyInlineDraft,
  checkRadio,
  draftUnchanged,
  itemIndexAt,
  itemListKey,
  readDraft,
  simpleEditKey,
  toggleCheckbox,
  type InlineEdit,
} from "../prototype/editing";
import {
  clickSelection,
  distanceLinesFor,
  elementAtPoint,
  expandToGroups,
  gridStep,
  marqueeHitTest,
  moveElementsByDelta,
  normalizeRect,
  snapDelta,
  snapRectToPeers,
  type CanvasRect,
  zoomToFit,
} from "../prototype/canvas-math";
import { alignElements, distributeElements, type AlignEdge, type DistributeAxis } from "../prototype/align";
import { ICON_DRAG_PREFIX, iconDisplayLabel } from "../prototype/icons";
import { TEMPLATE_DRAG_PREFIX, insertTemplateElements } from "../prototype/templates";
import type { Slide } from "./model";
import { useT } from "../../shared/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Drag =
  | { kind: "move"; ids: string[]; ox: number; oy: number; orig: Record<string, { x: number; y: number }> }
  | { kind: "resize"; id: string; handle: Handle; orig: WireframeElement }
  | { kind: "marquee"; ox: number; oy: number; contain: boolean }
  | { kind: "pan"; startX: number; startY: number; scrollLeft: number; scrollTop: number };

export function SlideBoard({
  slide,
  onChange,
  captureRef,
}: {
  slide: Slide;
  onChange: (slide: Slide) => void;
  captureRef?: React.MutableRefObject<(() => Promise<Blob>) | null>;
}) {
  const t = useT();
  const canvasPaneRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.65);
  const [snapGrid, setSnapGrid] = useState(true);
  const [fineGrid, setFineGrid] = useState(true);
  const [marquee, setMarquee] = useState<CanvasRect | null>(null);
  const [snapGuides, setSnapGuides] = useState<import("../prototype/canvas-math").SnapGuide[]>([]);
  const [distanceLines, setDistanceLines] = useState<import("../prototype/canvas-math").DistanceLine[]>([]);
  const [moveTooltip, setMoveTooltip] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [liveElements, setLiveElements] = useState<WireframeElement[] | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("style");
  const [edit, setEdit] = useState<InlineEdit | null>(null);
  const editRef = useRef<InlineEdit | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const skipBlur = useRef(false);
  editRef.current = edit;

  const elements = liveElements ?? slide.elements;
  const viewElements = elements;

  const replace = useCallback(
    (next: WireframeElement[]) => {
      setLiveElements(null);
      onChange({ ...slide, elements: next });
    },
    [onChange, slide],
  );

  const fakePage: WireframePage = useMemo(
    () => ({ id: slide.id, name: slide.name, canvas: slide.canvas, elements, notes: slide.notes }),
    [slide.id, slide.name, slide.canvas, slide.notes, elements],
  );

  useEffect(() => {
    const pane = canvasPaneRef.current;
    if (!pane) return;
    setZoom(zoomToFit(slide.canvas.width, slide.canvas.height, pane.clientWidth, pane.clientHeight));
  }, [slide.canvas.width, slide.canvas.height]);

  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = async () => {
      const node = boardRef.current;
      if (!node) throw new Error(t("protoCaptureFailed"));
      const lib = await loadScreenshotLibrary();
      return lib.domToBlob(node, {
        scale: 2,
        type: "image/png",
        filter: (item) => !(item instanceof Element && item.hasAttribute("data-proto-skip")),
      });
    };
  }, [captureRef, slide.id]);

  const boardPoint = (event: { clientX: number; clientY: number }) => {
    const box = boardRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return { x: (event.clientX - box.left) / zoom, y: (event.clientY - box.top) / zoom };
  };

  const selectedEls = viewElements.filter((el) => selected.includes(el.id));
  const one = selectedEls.length === 1 ? selectedEls[0] : null;
  const inspect = one && edit?.id === one.id ? applyInlineDraft(one, edit) : one;
  const notes = useMemo(() => noteNumbers(viewElements), [viewElements]);

  const updateOne = (patch: Partial<WireframeElement>) => {
    if (!one) return;
    replace(slide.elements.map((el) => (el.id === one.id ? { ...el, ...patch } : el)));
  };

  const updateMany = (mapper: (el: WireframeElement) => WireframeElement) => {
    replace(slide.elements.map((el) => mapper(el)));
  };

  const applyAlign = (edge: AlignEdge) => {
    if (!selected.length) return;
    replace(alignElements(slide.elements, selected, edge, slide.canvas));
  };

  const applyDistribute = (axis: DistributeAxis) => {
    if (selected.length < 3) return;
    replace(distributeElements(slide.elements, selected, axis));
  };

  const setProp = (key: string, value: PropValue) => {
    if (!one) return;
    if (one.type === "Radio" && key === "checked") {
      replace(setRadioChecked(slide.elements, one.id, value === true));
      return;
    }
    updateOne({ props: { ...one.props, [key]: value } });
  };

  const removeSelected = () => {
    if (!selected.length) return;
    replace(slide.elements.filter((el) => !selected.includes(el.id)));
    setSelected([]);
  };

  const addTile = (tile: PaletteTile, x?: number, y?: number) => {
    const spec = CATALOG_BY_TYPE[tile.type];
    const el = placeOnCanvas(
      elementFromTile(tile, x ?? (slide.canvas.width - spec.w) / 2, y ?? (slide.canvas.height - spec.h) / 2, slide.elements),
      slide.canvas,
    );
    replace([...slide.elements, el]);
    setSelected([el.id]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    const p = boardPoint(event);
    if (raw.startsWith(ICON_DRAG_PREFIX)) {
      const iconName = raw.slice(ICON_DRAG_PREFIX.length);
      if (!iconName) return;
      const size = 24;
      const el = placeOnCanvas(
        {
          ...defaultElement("Icon", p.x - 12, p.y - 12, slide.elements),
          props: { name: iconName, size, color: "foreground" },
          label: iconDisplayLabel(iconName),
          w: size,
          h: size,
        },
        slide.canvas,
      );
      replace([...slide.elements, el]);
      setSelected([el.id]);
      return;
    }
    if (raw.startsWith(TEMPLATE_DRAG_PREFIX)) {
      const templateId = raw.slice(TEMPLATE_DRAG_PREFIX.length);
      if (!templateId) return;
      const built = insertTemplateElements(templateId, p.x, p.y, slide.elements);
      if (!built?.length) return;
      const placed = built.map((el) => placeOnCanvas(el, slide.canvas));
      replace([...slide.elements, ...placed]);
      setSelected(placed.map((el) => el.id));
      return;
    }
    const tile = PALETTE_BY_ID[raw];
    if (!tile) return;
    addTile(tile, p.x - CATALOG_BY_TYPE[tile.type].w / 2, p.y - CATALOG_BY_TYPE[tile.type].h / 2);
  };

  const onPanePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.button !== 1) return;
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
      const target = viewElements.find((item) => item.id === id);
      if (target?.locked) return;
      const picked = clickSelection(selected, id, event.metaKey || event.ctrlKey, event.shiftKey);
      const ids = expandToGroups(viewElements, picked);
      setSelected(ids);
      const orig: Record<string, { x: number; y: number }> = {};
      for (const el of viewElements) if (ids.includes(el.id)) orig[el.id] = { x: el.x, y: el.y };
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
    if (!current) {
      if (event.altKey) {
        const hit = elementAtPoint(viewElements, p.x, p.y);
        setDistanceLines(hit ? distanceLinesFor(hit, viewElements) : []);
      } else setDistanceLines([]);
      return;
    }
    if (current.kind === "marquee") {
      setMarquee(normalizeRect(current.ox, current.oy, p.x, p.y));
      return;
    }
    if (current.kind === "move") {
      let dx = p.x - current.ox;
      let dy = p.y - current.oy;
      const bounds = selectionBounds(
        slide.elements.map((el) => {
          const from = current.orig[el.id];
          return from ? { ...el, x: from.x + dx, y: from.y + dy } : el;
        }),
        current.ids,
      );
      const guides: import("../prototype/canvas-math").SnapGuide[] = [];
      if (bounds) {
        const peerSnap = snapRectToPeers(bounds, slide.elements, new Set(current.ids));
        dx += peerSnap.dx;
        dy += peerSnap.dy;
        guides.push(...peerSnap.guides);
      }
      const grid = snapGrid ? gridStep(fineGrid) : null;
      const snapped = snapDelta(dx, dy, grid);
      setSnapGuides(guides);
      if (bounds) {
        setMoveTooltip({ x: bounds.left + snapped.dx, y: bounds.top + snapped.dy, w: bounds.right - bounds.left, h: bounds.bottom - bounds.top });
      }
      setLiveElements(moveElementsByDelta(slide.elements, new Set(current.ids), snapped.dx, snapped.dy, current.orig));
      return;
    }
    if (current.kind === "resize") {
      setLiveElements(slide.elements.map((el) => (el.id === current.id ? resized(current.orig, current.handle, p.x, p.y) : el)));
    }
  };

  const onBoardPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    setSnapGuides([]);
    setMoveTooltip(null);
    if (current?.kind === "marquee") {
      const p = boardPoint(event);
      const rect = normalizeRect(current.ox, current.oy, p.x, p.y);
      setMarquee(null);
      const hits = marqueeHitTest(viewElements, rect, current.contain ? "contain" : "intersect");
      setSelected(expandToGroups(viewElements, hits));
      return;
    }
    setMarquee(null);
    if (liveElements) {
      replace(liveElements);
      return;
    }
    if (current?.kind === "move") {
      const p = boardPoint(event);
      const grid = snapGrid ? gridStep(fineGrid) : null;
      const raw = snapDelta(p.x - current.ox, p.y - current.oy, grid);
      if (raw.dx === 0 && raw.dy === 0) {
        const el = slide.elements.find((item) => current.ids[0] === item.id);
        if (el && event.detail === 1 && (el.type === "Radio" || el.type === "Checkbox") && p.x - el.x < 28) {
          replace(el.type === "Radio" ? checkRadio(slide.elements, el.id) : toggleCheckbox(slide.elements, el.id));
        }
      }
    }
  };

  const onBoardDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const id = (event.target as HTMLElement).closest("[data-el]")?.getAttribute("data-el");
    const el = viewElements.find((item) => item.id === id);
    if (!el) return;
    event.preventDefault();
    const localX = boardPoint(event).x - el.x;
    const localY = boardPoint(event).y - el.y;
    const listKey = itemListKey(el.type);
    if (listKey) {
      const index = itemIndexAt(el, localX, localY);
      setSelected([el.id]);
      setEdit({ id: el.id, target: { kind: "item", key: listKey, index }, draft: readDraft(el, { kind: "item", key: listKey, index }) });
      return;
    }
    const key = simpleEditKey(el.type);
    if (key) {
      setSelected([el.id]);
      setEdit({ id: el.id, target: { kind: "prop", key }, draft: readDraft(el, { kind: "prop", key }) });
    }
  };

  const commitEdit = () => {
    const current = editRef.current;
    if (!current) return;
    const el = slide.elements.find((item) => item.id === current.id);
    if (!el || draftUnchanged(el, current)) {
      setEdit(null);
      return;
    }
    replace(slide.elements.map((item) => (item.id === current.id ? applyInlineDraft(item, current) : item)));
    setEdit(null);
  };

  const onInlineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const current = editRef.current;
    if (!current) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setEdit(null);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit();
    }
  };

  const selectionBand = selectionBounds(viewElements, selected);

  const paletteTiles = PALETTE_TILES.filter((tile) =>
    ["Heading", "Text", "Button", "Image", "Box", "Ellipse", "Line", "Icon", "Table", "List"].includes(tile.type),
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <aside className="flex w-44 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border p-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">{t("protoPalette")}</p>
        <ul className="flex flex-col gap-1">
          {paletteTiles.map((tile) => (
            <li key={tile.id}>
              <button
                type="button"
                className="w-full rounded-md border border-border/60 px-2 py-1.5 text-left text-xs hover:bg-state-hover"
                onClick={() => addTile(tile)}
              >
                {t(tile.labelKey, tile.labelParams)}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PrototypeCanvas
          canvasPaneRef={canvasPaneRef}
          boardRef={boardRef}
          openTabs={[fakePage]}
          activePageId={slide.id}
          onSelectPage={() => {}}
          onCloseTab={() => {}}
          canvas={slide.canvas}
          elements={viewElements}
          zoom={zoom}
          badges={false}
          notes={notes}
          selected={selected}
          one={inspect}
          edit={edit}
          editInputRef={editInputRef}
          selectionBand={selectionBand}
          showSnapGrid={snapGrid}
          gridSize={gridStep(fineGrid)}
          marquee={marquee}
          snapGuides={snapGuides}
          distanceLines={distanceLines}
          moveTooltip={moveTooltip}
          panning={panning}
          insertMode={false}
          onPanePointerDown={onPanePointerDown}
          onPanePointerMove={onPanePointerMove}
          onPanePointerUp={onPanePointerUp}
          onBoardPointerDown={onBoardPointerDown}
          onBoardPointerMove={onBoardPointerMove}
          onBoardPointerUp={onBoardPointerUp}
          onBoardDoubleClick={onBoardDoubleClick}
          onBoardContextMenu={(event) => event.preventDefault()}
          onDrop={onDrop}
          onEditChange={(draft) => edit && setEdit({ ...edit, draft })}
          onInlineKeyDown={onInlineKeyDown}
          onCommitEdit={commitEdit}
          skipBlur={skipBlur}
          onPaneClick={() => setEdit(null)}
        />
        {selected.length ? (
          <div className="flex shrink-0 gap-2 border-t border-border px-2 py-1">
            <Button type="button" size="sm" variant="outline" onClick={removeSelected}>{t("slidesDeleteElement")}</Button>
          </div>
        ) : null}
      </div>
      <aside className={cn("flex w-72 shrink-0 flex-col border-l border-border")}>
        <PrototypeInspector
          tab={inspectorTab}
          setTab={setInspectorTab}
          inspect={inspect}
          selection={selectedEls}
          elements={viewElements}
          canvas={slide.canvas}
          pageNotes={slide.notes ?? ""}
          noteMarkers={false}
          onNoteMarkers={() => {}}
          onPageNotes={(notesText) => onChange({ ...slide, notes: notesText })}
          onCanvas={(patch) => onChange({ ...slide, canvas: { ...slide.canvas, ...patch } })}
          updateOne={updateOne}
          updateMany={updateMany}
          setProp={setProp}
          onReplaceElement={(next) => replace(slide.elements.map((el) => (el.id === next.id ? next : el)))}
          onRadioGroup={(groupId) => {
            if (!one) return;
            if (groupId === "__create__") {
              replace(createRadioGroup(slide.elements, [one.id]));
              return;
            }
            replace(assignRadioGroup(slide.elements, one.id, groupId));
          }}
          onRadioChecked={(checked) => {
            if (!one) return;
            replace(setRadioChecked(slide.elements, one.id, checked));
          }}
          applyAlign={applyAlign}
          applyDistribute={applyDistribute}
        />
      </aside>
    </div>
  );
}

export async function slidePngBase64(capture: () => Promise<Blob>): Promise<string> {
  const blob = await capture();
  return blobToBase64(blob);
}
