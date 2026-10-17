import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export type AnchoredMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  separatorBefore?: boolean;
};

export function AnchoredMenu({
  open,
  x,
  y,
  items,
  onSelect,
  onClose,
  ariaLabel,
}: {
  open: boolean;
  x: number;
  y: number;
  items: readonly AnchoredMenuItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const enabledIndexes = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);

  useEffect(() => {
    if (!open) return;
    setFocusIndex(enabledIndexes[0] ?? 0);
  }, [open, items]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const rect = node.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
    node.style.left = `${Math.max(8, left)}px`;
    node.style.top = `${Math.max(8, top)}px`;
  }, [open, x, y, items]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
  }, [open]);

  if (!open) return null;

  const moveFocus = (delta: number) => {
    if (!enabledIndexes.length) return;
    const current = enabledIndexes.indexOf(focusIndex);
    const next = enabledIndexes[(current + delta + enabledIndexes.length) % enabledIndexes.length];
    if (next !== undefined) setFocusIndex(next);
  };

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      aria-label={ariaLabel}
      className="fixed z-[70] min-w-48 rounded-md border border-border bg-popover p-1 text-sm shadow-md outline-none"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(-1);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          if (enabledIndexes[0] !== undefined) setFocusIndex(enabledIndexes[0]);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          const last = enabledIndexes[enabledIndexes.length - 1];
          if (last !== undefined) setFocusIndex(last);
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const item = items[focusIndex];
          if (item && !item.disabled) {
            onSelect(item.id);
            onClose();
          }
        }
      }}
    >
      {items.map((item, index) => (
        <div key={item.id}>
          {item.separatorBefore ? <div className="my-1 h-px bg-border" role="separator" /> : null}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cn(
              "flex w-full items-center justify-between gap-4 rounded px-2 py-1.5 text-left hover:bg-state-hover disabled:opacity-40",
              index === focusIndex && "bg-state-hover",
            )}
            onMouseEnter={() => !item.disabled && setFocusIndex(index)}
            onClick={() => {
              if (item.disabled) return;
              onSelect(item.id);
              onClose();
            }}
          >
            <span>{item.label}</span>
            {item.shortcut ? <span className="text-xs text-muted-foreground">{item.shortcut}</span> : null}
          </button>
        </div>
      ))}
    </div>
  );
}
