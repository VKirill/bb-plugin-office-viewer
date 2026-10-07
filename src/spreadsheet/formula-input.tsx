// Single-line formula editor used in the cell and the formula bar: references
// are colored like Excel's, function names complete from the catalog, and the
// signature of the function around the caret is shown while typing arguments.
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { activeCall, applyCompletion, colorKey, completionAt, referenceColors, referenceSpans } from "./formula";

export type FormulaInputHandle = { focus(caret?: number): void; element: HTMLInputElement | null };

type Props = {
  value: string;
  caret: number;
  locale: "en" | "ru";
  ariaLabel: string;
  onChange(value: string, caret: number): void;
  onCaret(caret: number): void;
  onKeyDown?(event: KeyboardEvent<HTMLInputElement>): void;
  onFocus?(): void;
  onBlur?(): void;
  autoFocus?: boolean;
  readOnly?: boolean;
  className?: string;
  style?: CSSProperties;
};

export const FormulaInput = forwardRef<FormulaInputHandle, Props>(function FormulaInput(props, ref) {
  const { value, caret, locale } = props;
  const input = useRef<HTMLInputElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useImperativeHandle(ref, () => ({
    element: input.current,
    focus: (at) => {
      const el = input.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      const position = at ?? el.value.length;
      el.setSelectionRange(position, position);
    },
  }));

  // Keep the DOM caret where the parent put it (e.g. after inserting a reference).
  useLayoutEffect(() => {
    const el = input.current;
    if (el && document.activeElement === el && el.selectionStart !== caret && el.selectionStart === el.selectionEnd) el.setSelectionRange(caret, caret);
    if (mirror.current && el) mirror.current.style.transform = `translateX(${-el.scrollLeft}px)`;
    if (el && focused) setRect(el.getBoundingClientRect());
  }, [value, caret, focused]);

  const spans = referenceSpans(value);
  const colors = referenceColors(spans);
  const segments: { text: string; color?: string }[] = [];
  let at = 0;
  for (const span of spans) {
    if (span.start > at) segments.push({ text: value.slice(at, span.start) });
    segments.push({ text: span.text, color: colors.get(colorKey(span)) });
    at = span.end;
  }
  if (at < value.length) segments.push({ text: value.slice(at) });

  const completion = focused && !props.readOnly ? completionAt(value, caret) : null;
  const showCompletion = completion && completion.token !== dismissed ? completion : null;
  const call = focused && !showCompletion ? activeCall(value, caret) : null;
  const selected = showCompletion ? Math.min(index, showCompletion.items.length - 1) : 0;

  const accept = (itemIndex: number) => {
    if (!showCompletion) return;
    const next = applyCompletion(value, showCompletion, showCompletion.items[itemIndex]);
    props.onChange(next.text, next.caret);
    setIndex(0);
    // The browser keeps the old caret index when the value is replaced; move it after "(".
    requestAnimationFrame(() => {
      input.current?.setSelectionRange(next.caret, next.caret);
      props.onCaret(next.caret);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (showCompletion) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const n = showCompletion.items.length;
        setIndex((selected + (event.key === "ArrowDown" ? 1 : n - 1)) % n);
        return;
      }
      if (event.key === "Tab" || (event.key === "Enter" && !event.metaKey && !event.ctrlKey)) {
        event.preventDefault();
        accept(selected);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissed(showCompletion.token);
        return;
      }
    }
    props.onKeyDown?.(event);
  };

  const popup =
    rect && (showCompletion || call)
      ? createPortal(
          <div
            className="fixed z-[1000] min-w-64 max-w-md overflow-hidden rounded-md border border-border bg-popover text-xs text-popover-foreground shadow-md"
            style={{ left: rect.left, top: rect.bottom + 4 }}
            data-bb-ru-skip=""
            onMouseDown={(event) => event.preventDefault()}
          >
            {showCompletion ? (
              <ul role="listbox">
                {showCompletion.items.map((fn, i) => (
                  <li
                    key={fn.name}
                    role="option"
                    aria-selected={i === selected}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => accept(i)}
                    className={cn("flex cursor-default items-baseline gap-2 px-2 py-1", i === selected && "bg-accent")}
                  >
                    <span className="font-mono font-medium">{/[А-Яа-яЁё]/.test(showCompletion.token) ? fn.ru : fn.name}</span>
                    <span className="truncate text-muted-foreground">{locale === "ru" ? fn.hint : fn.en}</span>
                  </li>
                ))}
              </ul>
            ) : call ? (
              <div className="px-2 py-1">
                <span className="font-mono">
                  {call.fn.name}(
                  {call.fn.args.split(", ").map((arg, i, all) => (
                    <span key={i} className={cn(i === Math.min(call.arg, all.length - 1) && "font-semibold text-foreground underline")}>
                      {arg}
                      {i < all.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  )
                </span>
                <span className="ml-2 text-muted-foreground">{locale === "ru" ? call.fn.hint : call.fn.en}</span>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("relative overflow-hidden", props.className)} style={props.style} data-bb-ru-skip="">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-1">
        <div ref={mirror} className="whitespace-pre">
          {segments.map((segment, i) => (
            <span key={i} style={segment.color ? { color: segment.color } : undefined}>
              {segment.text}
            </span>
          ))}
        </div>
      </div>
      <input
        ref={input}
        value={value}
        readOnly={props.readOnly}
        autoFocus={props.autoFocus}
        spellCheck={false}
        aria-label={props.ariaLabel}
        onChange={(event) => {
          setDismissed(null);
          setIndex(0);
          props.onChange(event.target.value, event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) => props.onCaret(event.currentTarget.selectionStart ?? 0)}
        onScroll={(event) => {
          if (mirror.current) mirror.current.style.transform = `translateX(${-event.currentTarget.scrollLeft}px)`;
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setFocused(true);
          props.onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          props.onBlur?.();
        }}
        className="relative h-full w-full bg-transparent px-1 text-transparent caret-foreground outline-none selection:bg-sky-500/30"
      />
      {popup}
    </div>
  );
});
