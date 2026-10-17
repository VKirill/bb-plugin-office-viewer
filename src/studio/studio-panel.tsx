import { useState, type ComponentType } from "react";
import type { PluginThreadPanelProps } from "@get-bb/plugin-sdk/app";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useT } from "../shared/i18n";
import { OfficeStudioLogo, PaintLogo, PrototypeLogo, SlidesLogo } from "./logos";
import { StudioSettingsButton } from "./settings-dialog";
import { studioToolOf, type StudioTool } from "./studio-tool";
import { StudioToolView } from "./tools";

export const STUDIO_PANEL = "studio";
export const STUDIO_ICON = "Palette";
export { studioToolOf, type StudioTool };

const CARD =
  "group flex w-full items-center gap-3 rounded-[14px] border border-border/60 bg-card p-3 text-left shadow-sm " +
  "transition-[border-color,box-shadow,transform] duration-150 ease-out " +
  "hover:-translate-y-px hover:border-border hover:shadow-md " +
  "active:translate-y-0 active:border-border active:shadow-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0 " +
  "disabled:pointer-events-none disabled:border-dashed disabled:border-border disabled:bg-transparent disabled:shadow-none " +
  "@xl:h-full @xl:flex-col @xl:items-start @xl:gap-3 @xl:p-4";

const TOOLS: { id: StudioTool; Logo: ComponentType<{ className?: string }>; title: "studioPrototype" | "studioPaint" | "studioSlides"; desc: "studioPrototypeDesc" | "studioPaintDesc" | "studioSlidesDesc"; soon?: boolean }[] = [
  { id: "prototype", Logo: PrototypeLogo, title: "studioPrototype", desc: "studioPrototypeDesc" },
  { id: "paint", Logo: PaintLogo, title: "studioPaint", desc: "studioPaintDesc" },
  { id: "slides", Logo: SlidesLogo, title: "studioSlides", desc: "studioSlidesDesc" },
];

export function StudioPanel({ threadId, params }: PluginThreadPanelProps) {
  const t = useT();
  const [picked, setPicked] = useState<StudioTool | null>(() => studioToolOf(params));

  if (picked) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex min-h-10 shrink-0 items-center justify-between border-b border-border px-2 py-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2" aria-label={t("studioBack")} onClick={() => setPicked(null)}>
            <Icon name="ChevronLeft" className="size-4" />
            {t("studioBack")}
          </Button>
          <StudioSettingsButton />
        </div>
        <StudioToolView tool={picked} threadId={threadId} />
      </div>
    );
  }

  return (
    <div className="@container flex h-full min-h-0 flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 @xl:gap-6 @xl:p-5">
        <header className="flex items-center gap-3 px-1">
          <OfficeStudioLogo className="size-10 shrink-0 rounded-[27%] shadow-sm" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-foreground">{t("studio")}</h2>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{t("studioSubtitle")}</p>
          </div>
          <StudioSettingsButton />
        </header>
        <section aria-labelledby="studio-tools-label">
          <h3 id="studio-tools-label" className="mb-2 px-1 text-xs font-medium leading-4 text-muted-foreground">{t("studioToolsLabel")}</h3>
          <ul className="grid grid-cols-1 gap-2 @xl:grid-cols-3 @xl:gap-3">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <button type="button" disabled={tool.soon} onClick={() => setPicked(tool.id)} className={CARD}>
                  <tool.Logo className="size-11 shrink-0 rounded-[27%] shadow-sm transition-[opacity,filter] group-disabled:opacity-60 group-disabled:shadow-none group-disabled:grayscale-[35%] @xl:size-12" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 @xl:flex-wrap">
                      <span className="truncate text-sm font-medium leading-5 text-foreground group-disabled:text-muted-foreground">{t(tool.title)}</span>
                      {tool.soon ? (
                        <span className="inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">{t("studioSoon")}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-[18px] text-muted-foreground group-disabled:text-muted-foreground/80 @xl:line-clamp-3">{t(tool.desc)}</span>
                  </span>
                  {tool.soon ? null : (
                    <Icon name="ChevronRight" aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/50 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground group-focus-visible:translate-x-0.5 group-focus-visible:text-muted-foreground motion-reduce:transition-none @xl:hidden" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <ul className="flex flex-col gap-1.5 rounded-xl bg-muted/50 px-3 py-2.5 @xl:flex-row @xl:flex-wrap @xl:gap-x-5">
          <li className="flex items-center gap-2 text-xs leading-4 text-muted-foreground">
            <Icon name="Folder" aria-hidden="true" className="size-3.5 shrink-0 opacity-80" />{t("studioHintSaved")}
          </li>
          <li className="flex items-center gap-2 text-xs leading-4 text-muted-foreground">
            <Icon name="MessageSquare" aria-hidden="true" className="size-3.5 shrink-0 opacity-80" />{t("studioHintSend")}
          </li>
        </ul>
      </div>
    </div>
  );
}
