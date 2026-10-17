import { useCallback, useEffect, useRef, useState } from "react";
import { useComposer, useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { rpcContract } from "../../../server";
import { detectLocale, t } from "../../shared/i18n";
import {
  applyThemeToDeck,
  cloneDeck,
  duplicateSlide,
  getActiveSlide,
  newDeck,
  parseSlidesDeck,
  removeSlide,
  reorderSlides,
  setActiveSlideId,
  updateActiveSlide,
  LAYOUT_IDS,
  type SlideLayout,
  type SlidesDeck,
} from "./model";
import { LAYOUT_LABEL, slideFromLayout } from "./layouts";
import { SlideBoard, slidePngBase64 } from "./slide-board";
import { SlidesPresenter, presentStartIndex } from "./presenter";
import { deckToPptxBlob } from "./pptx-export";
import { ElementFace } from "../prototype/elements";
import { cn } from "@/lib/utils";

type SendKind = "both" | "png" | "pptx";

const MAX_HISTORY = 40;

export function SlidesEditor({ threadId }: { threadId: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const composer = useComposer();
  const locale = detectLocale();
  const captureRef = useRef<(() => Promise<Blob>) | null>(null);
  const dragSlide = useRef<number | null>(null);

  const [{ history, index }, setTimeline] = useState(() => ({ history: [newDeck()], index: 0 }));
  const deck = history[index]!;
  const active = getActiveSlide(deck);

  const [busy, setBusy] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [openedStem, setOpenedStem] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("Untitled");
  const [sendMenu, setSendMenu] = useState(false);

  const commit = useCallback((next: SlidesDeck) => {
    setTimeline((s) => {
      const kept = s.history.slice(Math.max(0, s.index + 1 - MAX_HISTORY), s.index + 1);
      return { history: [...kept, cloneDeck(next)], index: kept.length };
    });
  }, []);

  const patchActiveSlide = (slide: ReturnType<typeof getActiveSlide>) => {
    commit(updateActiveSlide(deck, () => slide));
  };

  const loadList = async () => {
    try {
      setSavedNames((await rpc.call("listSlides", { threadId, locale })).names);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    }
  };

  useEffect(() => {
    void loadList();
  }, [threadId]);

  const persist = async (name: string, overwrite: boolean) => {
    if (!captureRef.current) throw new Error(t("protoCaptureFailed"));
    const pngBase64 = await slidePngBase64(captureRef.current);
    const saved = await rpc.call("saveSlides", {
      threadId,
      name,
      json: JSON.stringify({ ...deck, name }),
      pngBase64,
      overwrite,
      locale,
    });
    commit({ ...deck, name });
    setOpenedStem(saved.name);
    return saved;
  };

  const save = async (overwrite: boolean) => {
    setBusy(true);
    try {
      const saved = await persist(saveName.trim() || deck.name, overwrite);
      toast.success(t("slidesSavedAs", { name: saved.name }));
      setSaveOpen(false);
      await loadList();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const loadOne = async (name: string) => {
    setBusy(true);
    try {
      const loaded = await rpc.call("loadSlides", { threadId, name, locale });
      const next = parseSlidesDeck(loaded.json);
      setTimeline({ history: [next], index: 0 });
      setOpenedStem(name);
      setOpenOpen(false);
      toast.success(t("slidesOpened", { name }));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const exportPng = async () => {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const blob = await captureRef.current();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${active.name.replace(/\s+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const exportPptx = async () => {
    setBusy(true);
    try {
      const blob = await deckToPptxBlob(deck);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.name.replace(/\s+/g, "-")}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const sendToChat = async (kind: SendKind) => {
    setSendMenu(false);
    setBusy(true);
    try {
      const saved = await persist(openedStem ?? deck.name, Boolean(openedStem));
      const files: File[] = [];
      if (kind !== "pptx" && captureRef.current) {
        files.push(new File([await captureRef.current()], `${saved.name}.png`, { type: "image/png" }));
      }
      if (kind !== "png") {
        files.push(new File([await deckToPptxBlob(deck)], `${saved.name}.pptx`, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
      }
      const attach = (composer as typeof composer & { experimental_vkAttachFiles?: (files: File[]) => Promise<void> }).experimental_vkAttachFiles;
      if (typeof attach === "function") {
        await attach.call(composer, files);
        toast.success(t("slidesSentChat"));
        return;
      }
      const note = t("slidesSendFallback", { json: saved.jsonPath, png: saved.pngPath });
      composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${note}\n\n`);
      composer.focus();
      toast.success(t("slidesSentChat"));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const addWithLayout = (layout: SlideLayout) => {
    const slide = slideFromLayout(layout, deck.theme);
    commit({ ...deck, slides: [...deck.slides, slide], activeSlideId: slide.id });
    setLayoutOpen(false);
  };

  const onSlideDragStart = (index: number) => {
    dragSlide.current = index;
  };

  const onSlideDrop = (toIndex: number) => {
    const from = dragSlide.current;
    dragSlide.current = null;
    if (from === null || from === toIndex) return;
    commit(reorderSlides(deck, from, toIndex));
  };

  const toggleTheme = () => {
    const mode = deck.theme.mode === "light" ? "dark" : "light";
    commit(applyThemeToDeck(deck, { ...deck.theme, mode }));
  };

  if (presenting) {
    return <SlidesPresenter deck={deck} startIndex={presentStartIndex(deck)} onClose={() => setPresenting(false)} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setTimeline({ history: [newDeck()], index: 0 }); setOpenedStem(null); }}>
          {t("slidesNew")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setSaveName(openedStem ?? deck.name); setSaveOpen(true); }}>
          {t("save")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { void loadList(); setOpenOpen(true); }}>
          {t("protoOpen")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setLayoutOpen(true)}>{t("slidesAddSlide")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => commit(duplicateSlide(deck, active.id))}>{t("slidesDuplicate")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || deck.slides.length <= 1} onClick={() => commit(removeSlide(deck, active.id))}>
          {t("slidesDelete")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setPresenting(true)}>{t("slidesPresent")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void exportPng()}>{t("slidesExportPng")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void exportPptx()}>{t("slidesExportPptx")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={toggleTheme}>{deck.theme.mode === "light" ? t("slidesThemeDark") : t("slidesThemeLight")}</Button>
        <div className="relative">
          <Button type="button" size="sm" disabled={busy} onClick={() => setSendMenu((v) => !v)}>{t("slidesSendChat")}</Button>
          {sendMenu ? (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-md border border-border bg-popover p-1 shadow-md">
              <button type="button" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-state-hover" onClick={() => void sendToChat("both")}>{t("slidesSendBoth")}</button>
              <button type="button" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-state-hover" onClick={() => void sendToChat("png")}>{t("slidesSendPng")}</button>
              <button type="button" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-state-hover" onClick={() => void sendToChat("pptx")}>{t("slidesSendPptx")}</button>
            </div>
          ) : null}
        </div>
        <Input className="ml-auto h-8 max-w-[12rem]" value={deck.name} onChange={(e) => commit({ ...deck, name: e.target.value })} aria-label={t("slidesDeckName")} />
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-36 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border p-2">
          {deck.slides.map((slide, slideIndex) => (
            <div
              key={slide.id}
              draggable
              onDragStart={() => onSlideDragStart(slideIndex)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onSlideDrop(slideIndex)}
              className={cn(
                "cursor-pointer rounded-md border p-1 transition-colors",
                slide.id === deck.activeSlideId ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-border/80",
              )}
              onClick={() => commit(setActiveSlideId(deck, slide.id))}
            >
              <div
                className="relative mx-auto overflow-hidden rounded-sm border border-border/50"
                style={{ width: 120, height: 68, background: slide.canvas.background }}
              >
                <div className="absolute left-0 top-0 origin-top-left" style={{ transform: "scale(0.09375)", width: slide.canvas.width, height: slide.canvas.height }}>
                  {slide.elements
                    .filter((el) => !el.hidden)
                    .map((el) => (
                      <div key={el.id} className="absolute overflow-hidden" style={{ left: el.x, top: el.y, width: el.w, height: el.h }}>
                        <ElementFace el={el} />
                      </div>
                    ))}
                </div>
              </div>
              <p className="mt-1 truncate text-center text-[10px] text-muted-foreground">{slide.name}</p>
            </div>
          ))}
        </aside>
        <SlideBoard slide={active} onChange={patchActiveSlide} captureRef={captureRef} />
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("save")}</DialogTitle></DialogHeader>
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void save(false)}>{t("slidesSaveCopy")}</Button>
            <Button type="button" disabled={busy} onClick={() => void save(true)}>{t("slidesSaveOverwrite")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openOpen} onOpenChange={setOpenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("protoOpen")}</DialogTitle></DialogHeader>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {savedNames.length === 0 ? <li className="text-sm text-muted-foreground">{t("slidesNoSaved")}</li> : null}
            {savedNames.map((name) => (
              <li key={name}>
                <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-state-hover" onClick={() => void loadOne(name)}>{name}</button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={layoutOpen} onOpenChange={setLayoutOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("slidesPickLayout")}</DialogTitle></DialogHeader>
          <ul className="grid gap-2">
            {LAYOUT_IDS.map((layout: SlideLayout) => (
              <li key={layout}>
                <button type="button" className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-state-hover" onClick={() => addWithLayout(layout)}>
                  {t(LAYOUT_LABEL[layout])}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
