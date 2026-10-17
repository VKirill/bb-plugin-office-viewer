import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import {
  INSPECTOR_COLOUR_PRESETS,
  formatHex,
  hexToHsl,
  hslToHex,
  normalizeColourInput,
  parseColour,
  rgbaToCss,
} from "./inspector-colour";

export function InspectorColourPicker({
  label,
  value,
  mixed,
  onChange,
}: {
  label: string;
  value: string | undefined;
  mixed?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const rgba = parseColour(value ?? "#000000") ?? { r: 0, g: 0, b: 0, a: 1 };
  const hsl = hexToHsl(rgbaToCss(rgba));
  const [hue, setHue] = useState(hsl.h);
  const [sat, setSat] = useState(hsl.s);
  const [light, setLight] = useState(hsl.l);
  const [alpha, setAlpha] = useState(rgba.a);

  useEffect(() => {
    const parsed = parseColour(value ?? "");
    if (!parsed) return;
    const next = hexToHsl(rgbaToCss(parsed));
    setHue(next.h);
    setSat(next.s);
    setLight(next.l);
    setAlpha(parsed.a);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const commitHsl = (h: number, s: number, l: number, a: number) => {
    const hex = hslToHex(h, s, l);
    const base = parseColour(hex) ?? { r: 0, g: 0, b: 0, a: 1 };
    onChange(rgbaToCss({ ...base, a }));
  };

  const swatch = mixed ? "linear-gradient(135deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)" : rgbaToCss({ ...rgba, a: mixed ? 1 : alpha });

  return (
    <div ref={rootRef} className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="size-7 shrink-0 rounded border border-border"
          style={{ background: swatch }}
          aria-label={label}
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        />
        <Input
          className="h-7 flex-1 font-mono text-xs"
          value={mixed ? "" : value ?? ""}
          placeholder={mixed ? "—" : "#FFFFFF"}
          onChange={(event) => onChange(normalizeColourInput(event.target.value))}
        />
      </div>
      {open ? (
        <div className="rounded-md border border-border bg-popover p-2 shadow-md">
          <div
            className="relative mb-2 h-24 w-full cursor-crosshair rounded"
            style={{ background: `hsl(${hue} 100% 50%)` }}
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const move = (clientX: number, clientY: number) => {
                const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
                const l = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
                setSat(s);
                setLight(l * 0.5);
                commitHsl(hue, s, l * 0.5, alpha);
              };
              move(event.clientX, event.clientY);
              const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", () => window.removeEventListener("pointermove", onMove), { once: true });
            }}
          >
            <div className="absolute inset-0 rounded bg-gradient-to-r from-white to-transparent" />
            <div className="absolute inset-0 rounded bg-gradient-to-t from-black to-transparent" />
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            className="mb-2 w-full"
            onChange={(event) => {
              const h = Number(event.target.value);
              setHue(h);
              commitHsl(h, sat, light, alpha);
            }}
          />
          <label className="mb-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t("protoColourOpacity")}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(alpha * 100)}
              className="flex-1"
              onChange={(event) => {
                const a = Number(event.target.value) / 100;
                setAlpha(a);
                commitHsl(hue, sat, light, a);
              }}
            />
          </label>
          <div className="mb-2 grid grid-cols-5 gap-1">
            {INSPECTOR_COLOUR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={cn("size-6 rounded border border-border", value === preset && "ring-2 ring-ring")}
                style={{ background: preset === "transparent" ? "linear-gradient(45deg, #ccc 25%, transparent 25%)" : preset }}
                onClick={() => onChange(preset)}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full gap-1 text-xs"
            onClick={async () => {
              const EyeDropper = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
              if (!EyeDropper) return;
              try {
                const result = await new EyeDropper().open();
                onChange(result.sRGBHex);
              } catch {
                // cancelled
              }
            }}
          >
            <Icon name="Target" className="size-3.5" />
            {t("protoColourEyedropper")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
