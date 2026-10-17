import { useState } from "react";
import type { PluginThreadPanelProps } from "@get-bb/plugin-sdk/app";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { t } from "../shared/i18n";
import { studioToolOf, type StudioTool } from "./studio-tool";
import { PaintTool, PrototypeTool } from "./tools";

export const STUDIO_PANEL = "studio";
export const STUDIO_ICON = "Palette";
export { studioToolOf, type StudioTool };

const TOOLS: { id: StudioTool; icon: IconName; title: "studioPrototype" | "studioPaint" | "studioSlides"; desc: "studioPrototypeDesc" | "studioPaintDesc" | "studioSlidesDesc"; soon?: boolean }[] = [
  { id: "prototype", icon: "Layers", title: "studioPrototype", desc: "studioPrototypeDesc" },
  { id: "paint", icon: "Palette", title: "studioPaint", desc: "studioPaintDesc" },
  { id: "slides", icon: "FileText", title: "studioSlides", desc: "studioSlidesDesc", soon: true },
];

export function StudioPanel({ threadId, params }: PluginThreadPanelProps) {
  const [picked, setPicked] = useState<StudioTool | null>(() => studioToolOf(params));

  if (picked) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex min-h-10 shrink-0 items-center border-b border-border px-2 py-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2" aria-label={t("studioBack")} onClick={() => setPicked(null)}>
            <Icon name="ChevronLeft" className="size-4" />
            {t("studioBack")}
          </Button>
        </div>
        {picked === "prototype" ? <PrototypeTool threadId={threadId} /> : picked === "paint" ? <PaintTool threadId={threadId} /> : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {t("studioSlides")} · {t("studioSoon")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background p-4">
      <div className="flex flex-col gap-2">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            disabled={tool.soon}
            onClick={() => setPicked(tool.id)}
            className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-state-hover disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon name={tool.icon} className="size-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-medium">{t(tool.title)}</span>
                {tool.soon ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t("studioSoon")}</span> : null}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{t(tool.desc)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
