import { useEffect, useRef } from "react";
import { t } from "../../shared/i18n";

export type ContextMenuAction =
  | "cut"
  | "copy"
  | "paste"
  | "duplicate"
  | "delete"
  | "group"
  | "ungroup"
  | "lock"
  | "unlock"
  | "hide"
  | "show"
  | "bringForward"
  | "sendBackward";

export function PrototypeContextMenu({
  open,
  x,
  y,
  canPaste,
  canGroup,
  canUngroup,
  locked,
  hidden,
  onAction,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  canPaste: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  locked: boolean;
  hidden: boolean;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const item = (action: ContextMenuAction, label: string, shortcut?: string, disabled = false) => (
    <button
      key={action}
      type="button"
      disabled={disabled}
      className="flex w-full items-center justify-between gap-4 rounded px-2 py-1.5 text-left text-sm hover:bg-state-hover disabled:opacity-40"
      onClick={() => {
        onAction(action);
        onClose();
      }}
    >
      <span>{label}</span>
      {shortcut ? <span className="text-xs text-muted-foreground">{shortcut}</span> : null}
    </button>
  );

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-48 rounded-md border border-border bg-popover p-1 shadow-md"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {item("cut", t("protoCtxCut"), "⌘X")}
      {item("copy", t("protoCtxCopy"), "⌘C")}
      {item("paste", t("protoCtxPaste"), "⌘V", !canPaste)}
      {item("duplicate", t("protoCtxDuplicate"), "⌘D")}
      <div className="my-1 h-px bg-border" />
      {item("group", t("protoCtxGroup"), "⌘G", !canGroup)}
      {item("ungroup", t("protoCtxUngroup"), "⌘⇧G", !canUngroup)}
      <div className="my-1 h-px bg-border" />
      {locked ? item("unlock", t("protoCtxUnlock"), "⌘L") : item("lock", t("protoCtxLock"), "⌘L")}
      {hidden ? item("show", t("protoCtxShow"), "⌘⇧H") : item("hide", t("protoCtxHide"), "⌘H")}
      <div className="my-1 h-px bg-border" />
      {item("bringForward", t("protoCtxBringForward"), "⌘]")}
      {item("sendBackward", t("protoCtxSendBackward"), "⌘[")}
      <div className="my-1 h-px bg-border" />
      {item("delete", t("protoCtxDelete"), "⌫")}
    </div>
  );
}
