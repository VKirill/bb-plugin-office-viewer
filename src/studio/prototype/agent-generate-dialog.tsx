import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useComposer, useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { rpcContract } from "../../../server";
import { studioLocale, useT } from "../../shared/i18n";
import {
  type AgentGenerateDevice,
  type AgentGenerateFidelity,
  buildScreenshotGeneratePrompt,
  buildTextGeneratePrompt,
  deviceCanvasSize,
  slugWireframeStem,
} from "./agent-prompts";
import { newWireframe, parseWireframe } from "./model";
import { upsertAgentTraceLayer } from "./agent-trace";

type Mode = "text" | "image";

export function AgentGenerateDialog({
  threadId,
  open,
  onOpenChange,
  onOpened,
}: {
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: (name: string, docJson: string) => void;
}) {
  const t = useT();
  const locale = studioLocale();
  const rpc = useRpc<typeof rpcContract>();
  const composer = useComposer();
  const [mode, setMode] = useState<Mode>("text");
  const [description, setDescription] = useState("");
  const [device, setDevice] = useState<AgentGenerateDevice>("desktop");
  const [fidelity, setFidelity] = useState<AgentGenerateFidelity>("medium");
  const [busy, setBusy] = useState(false);
  const [refFile, setRefFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setDescription("");
    setDevice("desktop");
    setFidelity("medium");
    setMode("text");
    setRefFile(null);
  }, []);

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("read failed"));
          return;
        }
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsDataURL(blob);
    });

  const pickImage = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setRefFile(file);
    setMode("image");
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    pickImage(event.dataTransfer.files[0] ?? null);
  };

  const send = async () => {
    setBusy(true);
    try {
      const { schemaMdPath } = await rpc.call("ensureWireframeAgentSchema", { threadId, locale });
      const stem = slugWireframeStem(description);
      const size = deviceCanvasSize(device);
      let doc = newWireframe(stem, { ...size, background: "#ffffff" });
      let refAbsPath: string | null = null;
      if (mode === "image" && refFile) {
        const ext = refFile.name.includes(".") ? refFile.name.slice(refFile.name.lastIndexOf(".")) : ".png";
        const refName = `ref-${Date.now().toString(36)}${ext}`;
        const saved = await rpc.call("savePrototypeRef", {
          threadId,
          fileName: refName,
          base64: await blobToBase64(refFile),
          contentType: refFile.type || "image/png",
          locale,
        });
        refAbsPath = saved.absPath;
        doc = upsertAgentTraceLayer(doc, `refs/${refName}`);
      }
      const json = JSON.stringify({ ...doc, name: stem }, null, 2);
      parseWireframe(json);
      const saved = await rpc.call("saveWireframe", {
        threadId,
        name: stem,
        json,
        overwrite: false,
        locale,
      });
      const wireframeAbsPath = saved.jsonPath;
      const prompt =
        mode === "image" && refAbsPath
          ? buildScreenshotGeneratePrompt({
              description,
              schemaAbsPath: schemaMdPath,
              wireframeAbsPath,
              refAbsPath,
            })
          : buildTextGeneratePrompt({
              description,
              device,
              fidelity,
              schemaAbsPath: schemaMdPath,
              wireframeAbsPath,
            });
      composer.updateText((draft) => `${draft.trim() ? `${draft.trimEnd()}\n\n` : ""}${prompt}\n\n`);
      composer.focus();
      onOpened(saved.name, json);
      onOpenChange(false);
      reset();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="max-w-lg" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <DialogHeader>
          <DialogTitle>{t("protoAgentGenerateTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mode === "text" ? "default" : "outline"} onClick={() => setMode("text")}>
            {t("protoAgentGenerateText")}
          </Button>
          <Button type="button" size="sm" variant={mode === "image" ? "default" : "outline"} onClick={() => setMode("image")}>
            {t("protoAgentGenerateImage")}
          </Button>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">{t("protoAgentGenerateDescription")}</span>
          <Textarea
            id="proto-agent-desc"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("protoAgentGenerateDescriptionPlaceholder")}
          />
        </label>
        {mode === "text" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">{t("protoAgentGenerateDevice")}</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={device}
                onChange={(event) => setDevice(event.target.value as AgentGenerateDevice)}
              >
                <option value="desktop">{t("protoDesktop")}</option>
                <option value="tablet">{t("protoTablet")}</option>
                <option value="phone">{t("protoPhone")}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">{t("protoAgentGenerateFidelity")}</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={fidelity}
                onChange={(event) => setFidelity(event.target.value as AgentGenerateFidelity)}
              >
                <option value="low">{t("protoAgentFidelityLow")}</option>
                <option value="medium">{t("protoAgentFidelityMedium")}</option>
                <option value="high">{t("protoAgentFidelityHigh")}</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => pickImage(event.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {t("protoAgentGeneratePickImage")}
            </Button>
            {refFile ? <p className="text-xs text-muted-foreground">{refFile.name}</p> : <p className="text-xs text-muted-foreground">{t("protoAgentGenerateDropHint")}</p>}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={busy || (mode === "text" ? !description.trim() : !refFile)}
            onClick={() => {
              void send().catch(() => {});
            }}
          >
            {t("protoAgentGenerateSend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
