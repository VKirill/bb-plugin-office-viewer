import { useT } from "../shared/i18n";
import { autosaveLabelKey, type AutosaveStatus } from "./session";

export function AutosaveLabel({ status }: { status: AutosaveStatus }) {
  const t = useT();
  const key = autosaveLabelKey(status);
  if (!key) return null;
  return (
    <span className="px-2 text-xs text-muted-foreground" aria-live="polite">
      {t(key)}
    </span>
  );
}
