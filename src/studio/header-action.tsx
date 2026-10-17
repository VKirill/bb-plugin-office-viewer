import { useBbNavigate } from "@get-bb/plugin-sdk/app";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { t } from "../shared/i18n";
import { STUDIO_ICON, STUDIO_PANEL } from "./studio-panel";

export function StudioHeaderAction({ threadId }: { threadId: string }) {
  const navigate = useBbNavigate();
  return (
    <span title={t("studio")} className="shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        aria-label={t("studio")}
        data-thread-id={threadId}
        onClick={() => {
          const opened = navigate.openThreadPanel({ actionId: STUDIO_PANEL, title: t("studio") });
          if (!opened) console.warn("Office Studio panel did not open");
        }}
      >
        <Icon name={STUDIO_ICON} className="size-4" aria-hidden="true" />
      </Button>
    </span>
  );
}
