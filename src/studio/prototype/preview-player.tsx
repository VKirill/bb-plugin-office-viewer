import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import { ConnectorsLayer } from "./connector-layer";
import { isConnector } from "./connectors";
import { ElementFace } from "./elements";
import { wireframeElementBoxStyle } from "./inspector-model";
import {
  dispatchInteraction,
  initialPreviewState,
  materializePage,
  runPendingEffects,
  type InteractionEvent,
  type PreviewState,
} from "./interactions";
import type { Wireframe, WireframeElement } from "./model";
import { noteNumbers } from "./builder-geometry";

export function PrototypePreviewPlayer({
  doc,
  onClose,
  onSendScreenshot,
  boardRef: externalBoardRef,
}: {
  doc: Wireframe;
  onClose: () => void;
  onSendScreenshot?: () => void | Promise<void>;
  boardRef?: RefObject<HTMLDivElement | null>;
}) {
  const t = useT();
  const [state, setState] = useState<PreviewState>(() => initialPreviewState(doc));
  const [zoom, setZoom] = useState(1);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const internalBoardRef = useRef<HTMLDivElement>(null);
  const boardRef = externalBoardRef ?? internalBoardRef;
  const scrollRef = useRef<HTMLDivElement>(null);

  const page = doc.pages.find((item) => item.id === state.pageId) ?? doc.pages[0]!;
  const elements = useMemo(() => materializePage(page, state), [page, state]);
  const notes = useMemo(() => (showNotes ? noteNumbers(elements) : new Map<string, number>()), [elements, showNotes]);

  useEffect(() => {
    if (!state.scrollToId || !scrollRef.current) return;
    const node = scrollRef.current.querySelector(`[data-preview-el="${state.scrollToId}"]`);
    node?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setState((prev) => ({ ...prev, scrollToId: null }));
  }, [state.scrollToId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const runEvent = useCallback(
    (el: WireframeElement, event: InteractionEvent) => {
      setState((prev) => {
        const result = dispatchInteraction(doc, prev, el, event);
        void (async () => {
          for (const effect of result.effects) {
            if (effect.type === "openLink" && effect.url) {
              window.open(effect.url, effect.target ?? "_blank", "noopener,noreferrer");
            }
          }
          await runPendingEffects(result.effects.filter((item) => item.type === "wait"));
        })();
        return result.state;
      });
    },
    [doc],
  );

  const fitZoom = () => {
    const pane = scrollRef.current;
    if (!pane) return;
    const scale = Math.min((pane.clientWidth - 48) / page.canvas.width, (pane.clientHeight - 48) / page.canvas.height, 1);
    setZoom(Math.max(0.25, scale));
  };

  useEffect(() => {
    fitZoom();
  }, [page.canvas.width, page.canvas.height]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          <Icon name="X" className="size-4" />
          {t("protoPreviewClose")}
        </Button>
        <span className="text-sm font-medium">{doc.name}</span>
        <span className="text-xs text-muted-foreground">{page.name}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            value={state.pageId}
            onChange={(event) => setState(initialPreviewState(doc, event.target.value))}
          >
            {doc.pages.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <Button type="button" size="sm" variant={showHotspots ? "secondary" : "outline"} className="h-8 text-xs" onClick={() => setShowHotspots((on) => !on)}>
            {t("protoPreviewHotspots")}
          </Button>
          <Button type="button" size="sm" variant={showNotes ? "secondary" : "outline"} className="h-8 text-xs" onClick={() => setShowNotes((on) => !on)}>
            {t("protoPreviewNotes")}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}>−</Button>
          <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>+</Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={fitZoom}>{t("zoomFit")}</Button>
          {onSendScreenshot ? (
            <Button type="button" size="sm" variant="default" className="h-8 text-xs" onClick={() => void onSendScreenshot()}>
              {t("protoPreviewSendChat")}
            </Button>
          ) : null}
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6">
        <div className="mx-auto" style={{ width: page.canvas.width * zoom, height: page.canvas.height * zoom }}>
          <div
            ref={boardRef}
            className="relative shadow-md"
            style={{
              width: page.canvas.width,
              height: page.canvas.height,
              background: page.canvas.background,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {elements
              .filter((el) => !isConnector(el))
              .map((el) => (
                <div
                  key={el.id}
                  data-preview-el={el.id}
                  className={cn(
                    "absolute cursor-pointer",
                    el.type === "HotSpot" && showHotspots && "border-2 border-dashed border-amber-500/80 bg-amber-500/10",
                  )}
                  style={{ left: el.x, top: el.y, width: el.w, height: el.h, ...wireframeElementBoxStyle(el, "base") }}
                  onClick={(event) => {
                    event.stopPropagation();
                    void runEvent(el, "click");
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    void runEvent(el, "doubleClick");
                  }}
                  onMouseEnter={() => void runEvent(el, "mouseEnter")}
                  onMouseLeave={() => void runEvent(el, "mouseLeave")}
                >
                  <div className="pointer-events-none size-full overflow-hidden">
                    <ElementFace el={el} allElements={elements} components={doc.components ?? []} />
                  </div>
                  {showNotes && notes.get(el.id) !== undefined ? (
                    <span className="pointer-events-none absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground">
                      {notes.get(el.id)}
                    </span>
                  ) : null}
                </div>
              ))}
            <ConnectorsLayer elements={elements} selected={[]} connectorTool={false} hoverElementId={null} draftLine={null} />
          </div>
        </div>
      </div>
    </div>
  );
}
