import { useEffect, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { rpcContract } from "../../../server";
import { ImageEditor, type WriteImage } from "../../media/image-editor";
import { detectLocale, t } from "../../shared/i18n";
import {
  PAINT_BACKGROUNDS,
  PAINT_FORMAT,
  PAINT_SIZE_PRESETS,
  PAINT_VERSION,
  parsePaintDoc,
  type PaintCanvas,
  type PaintShape,
} from "./paint-model";

type Session = {
  id: string;
  image: HTMLCanvasElement;
  name: string;
  shapes: PaintShape[];
  openedStem: string | null;
  canvas: PaintCanvas;
};

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function blankCanvas(width: number, height: number, background: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  if (background && background !== "transparent") {
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

function clampSize(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(8192, Math.round(value)));
}

export function PaintCanvas({ threadId }: { threadId: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const locale = detectLocale();
  const [session, setSession] = useState<Session | null>(null);
  const [preset, setPreset] = useState<keyof typeof PAINT_SIZE_PRESETS | "custom">("wide");
  const [custom, setCustom] = useState<{ width: number; height: number }>({ ...PAINT_SIZE_PRESETS.wide });
  const [background, setBackground] = useState<string>(PAINT_BACKGROUNDS.white);
  const [savedNames, setSavedNames] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const size = preset === "custom" ? custom : PAINT_SIZE_PRESETS[preset];

  const start = (canvas: PaintCanvas, name = "Untitled", shapes: PaintShape[] = [], openedStem: string | null = null) => {
    setSession({
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      image: blankCanvas(canvas.width, canvas.height, canvas.background),
      name: `${name}.png`,
      shapes,
      openedStem,
      canvas,
    });
  };

  const write: WriteImage = async (name, blob, overwrite, meta) => {
    if (!session) throw new Error(t("saveFailed"));
    const stem = name.replace(/\.[^.]+$/, "") || "Untitled";
    const doc = parsePaintDoc({
      format: PAINT_FORMAT,
      version: PAINT_VERSION,
      name: stem,
      canvas: session.canvas,
      shapes: meta?.shapes ?? [],
    });
    const saved = await rpc.call("savePaint", {
      threadId,
      name: stem,
      json: JSON.stringify(doc),
      pngBase64: await blobToBase64(blob),
      overwrite,
      locale,
    });
    setSession((current) => (current ? { ...current, name: `${saved.name}.png`, openedStem: saved.name, canvas: { ...current.canvas } } : current));
    return { name: saved.name, absPath: saved.pngPath };
  };

  const loadList = async () => {
    try {
      setSavedNames((await rpc.call("listPaints", { threadId, locale })).names);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    }
  };

  useEffect(() => {
    if (session) return;
    void loadList();
  }, [session, threadId]);

  const loadOne = async (name: string) => {
    setBusy(true);
    try {
      const loaded = await rpc.call("loadPaint", { threadId, name, locale });
      const doc = parsePaintDoc(loaded.json);
      start(doc.canvas, doc.name, doc.shapes, name);
      toast.success(t("paintOpened", { name }));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    return (
      <ImageEditor
        key={session.id}
        image={session.image}
        name={session.name}
        write={write}
        variant="paint"
        initialShapes={session.shapes}
        defaultSaveStem={session.openedStem ?? "Untitled"}
        persistOnSend
        onClose={() => setSession(null)}
        overwriteFormat={session.openedStem ? "png" : null}
        onSaved={(saved) => {
          setSession((current) => (current ? { ...current, name: `${saved.name}.png`, openedStem: saved.name } : current));
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-thread-id={threadId}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">{t("protoW")} × {t("protoH")}</div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(PAINT_SIZE_PRESETS) as (keyof typeof PAINT_SIZE_PRESETS)[]).map((id) => (
              <Button key={id} type="button" variant="ghost" size="sm" className="h-8" aria-pressed={preset === id} onClick={() => setPreset(id)}>
                {t(id === "wide" ? "paintPresetWide" : id === "hd" ? "paintPresetHd" : "paintPresetSquare")}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              aria-pressed={preset === "custom"}
              onClick={() => {
                setCustom(size);
                setPreset("custom");
              }}
            >
              {t("paintCustom")}
            </Button>
          </div>
          <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">{t("protoW")}</span>
              <Input
                type="number"
                min={1}
                max={8192}
                value={size.width}
                onChange={(event) => {
                  setCustom({ width: clampSize(Number(event.target.value)), height: size.height });
                  setPreset("custom");
                }}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">{t("protoH")}</span>
              <Input
                type="number"
                min={1}
                max={8192}
                value={size.height}
                onChange={(event) => {
                  setCustom({ width: size.width, height: clampSize(Number(event.target.value)) });
                  setPreset("custom");
                }}
              />
            </label>
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">{t("protoBackground")}</div>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-8" aria-pressed={background === PAINT_BACKGROUNDS.white} onClick={() => setBackground(PAINT_BACKGROUNDS.white)}>
              {t("paintBgWhite")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8" aria-pressed={background === PAINT_BACKGROUNDS.transparent} onClick={() => setBackground(PAINT_BACKGROUNDS.transparent)}>
              {t("paintBgTransparent")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8" aria-pressed={background === PAINT_BACKGROUNDS.dark} onClick={() => setBackground(PAINT_BACKGROUNDS.dark)}>
              {t("paintBgDark")}
            </Button>
          </div>
        </div>
        <div>
          <Button type="button" disabled={busy} onClick={() => start({ width: clampSize(size.width), height: clampSize(size.height), background })}>
            {t("paintStart")}
          </Button>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="text-xs font-medium text-muted-foreground">{t("protoOpen")}</div>
            <Button type="button" variant="ghost" size="sm" className="h-8" disabled={busy} onClick={() => void loadList()}>
              {t("protoOpen")}
            </Button>
          </div>
          {savedNames === null ? null : savedNames.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("paintNoSaved")}</div>
          ) : (
            <div className="flex max-h-64 flex-col gap-1 overflow-auto">
              {savedNames.map((name) => (
                <button key={name} type="button" className="rounded-md border border-border px-2 py-1.5 text-left text-sm hover:bg-state-hover" onClick={() => void loadOne(name)}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
