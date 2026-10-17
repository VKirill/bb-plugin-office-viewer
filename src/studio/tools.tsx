import { t } from "../shared/i18n";

function Placeholder({ label, threadId }: { label: string; threadId: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground" data-thread-id={threadId}>
      {label}
    </div>
  );
}

/** Later tasks replace this with the prototype builder. */
export function PrototypeTool({ threadId }: { threadId: string }) {
  return <Placeholder label={t("studioPrototype")} threadId={threadId} />;
}

/** Later tasks replace this with the paint canvas. */
export function PaintTool({ threadId }: { threadId: string }) {
  return <Placeholder label={t("studioPaint")} threadId={threadId} />;
}
