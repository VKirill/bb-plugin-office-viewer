import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useT } from "../../shared/i18n";
import {
  CHECKERBOARD_BG,
  HUE_SLIDER_BG,
  INSPECTOR_COLOUR_PRESETS,
  colourIsNone,
  collectDocumentColours,
  formatHex,
  formatRgbChannels,
  hexToHsl,
  hslToHex,
  normalizeColourInput,
  parseColour,
  parseRgbChannels,
  resolvePickerColour,
  rgbaToCss,
  type Rgba,
} from "./inspector-colour";

const RANGE_THUMB =
  "h-2 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-background";

export function InspectorColourPicker({
  label,
  value,
  fallback,
  mixed,
  documentColours,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  mixed?: boolean;
  documentColours?: string[];
  onChange: (value: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const none = colourIsNone(value);
  const rgba = useMemo(() => resolvePickerColour(none ? "transparent" : value, fallback), [none, value, fallback]);
  const hsl = hexToHsl(rgbaToCss({ ...rgba, a: 1 }));
  const [hue, setHue] = useState(hsl.h);
  const [sat, setSat] = useState(hsl.s);
  const [light, setLight] = useState(hsl.l);
  const [alpha, setAlpha] = useState(rgba.a);
  const [hexDraft, setHexDraft] = useState(formatHex(rgba));
  const [rgbDraft, setRgbDraft] = useState(formatRgbChannels(rgba));

  useEffect(() => {
    const next = resolvePickerColour(none ? "transparent" : value, fallback);
    const nextHsl = hexToHsl(rgbaToCss({ ...next, a: 1 }));
    setHue(nextHsl.h);
    setSat(nextHsl.s);
    setLight(nextHsl.l);
    setAlpha(next.a);
    setHexDraft(formatHex(next));
    setRgbDraft(formatRgbChannels(next));
  }, [value, fallback, none]);

  const commitRgba = (next: Rgba) => {
    if (next.a <= 0) onChange("transparent");
    else onChange(rgbaToCss(next));
  };

  const commitHsl = (h: number, s: number, l: number, a: number) => {
    const hex = hslToHex(h, s, l);
    const base = parseColour(hex) ?? { r: 0, g: 0, b: 0, a: 1 };
    const next = { ...base, a };
    setHexDraft(formatHex(next));
    setRgbDraft(formatRgbChannels(next));
    commitRgba(next);
  };

  const swatchStyle = none
    ? { background: CHECKERBOARD_BG }
    : { background: rgbaToCss({ ...rgba, a: Math.max(alpha, 0.15) }) };

  const alphaTrack = `linear-gradient(to right, transparent, ${rgbaToCss({ ...rgba, a: 1 })}), ${CHECKERBOARD_BG}`;

  const docColours = documentColours ?? [];

  const pickEyedropper = async () => {
    const EyeDropper = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!EyeDropper) return;
    try {
      const result = await new EyeDropper().open();
      onChange(normalizeColourInput(result.sRGBHex));
    } catch {
      // cancelled
    }
  };

  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex min-w-0 items-center gap-1">
          <PopoverTrigger asChild>
            <button
              type="button"
              className="size-7 shrink-0 rounded border border-border"
              style={swatchStyle}
              aria-label={label}
              aria-expanded={open}
            />
          </PopoverTrigger>
          <Input
            className="h-7 min-w-0 flex-1 px-2 font-mono text-xs"
            value={mixed ? "" : none ? t("protoColourNone") : hexDraft}
            readOnly={none}
            placeholder={mixed ? "—" : formatHex(resolvePickerColour(undefined, fallback))}
            onChange={(event) => {
              const parsed = parseColour(event.target.value);
              if (!parsed) {
                setHexDraft(event.target.value);
                return;
              }
              const next = { ...parsed, a: alpha };
              setHexDraft(formatHex(next));
              setRgbDraft(formatRgbChannels(next));
              commitRgba(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") setOpen(true);
            }}
          />
          <Input
            className="h-7 w-12 shrink-0 px-1 text-center text-xs tabular-nums"
            inputMode="numeric"
            value={mixed ? "" : none ? "—" : String(Math.round(alpha * 100))}
            disabled={mixed || none}
            placeholder={mixed ? "—" : "%"}
            onChange={(event) => {
              const pct = Number(event.target.value);
              if (!Number.isFinite(pct)) return;
              const a = Math.min(100, Math.max(0, pct)) / 100;
              setAlpha(a);
              commitHsl(hue, sat, light, a);
            }}
          />
        </div>
        <PopoverContent
          className="w-[min(16rem,calc(100vw-1rem))]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
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
            aria-label={t("protoColourHue")}
            className={RANGE_THUMB}
            style={{ background: HUE_SLIDER_BG }}
            onChange={(event) => {
              const h = Number(event.target.value);
              setHue(h);
              commitHsl(h, sat, light, alpha);
            }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(alpha * 100)}
            aria-label={t("protoColourOpacity")}
            className={cn(RANGE_THUMB, "mt-2")}
            style={{ background: alphaTrack }}
            onChange={(event) => {
              const a = Number(event.target.value) / 100;
              setAlpha(a);
              commitHsl(hue, sat, light, a);
            }}
          />
          <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-muted-foreground">{t("protoColourHex")}</span>
            <Input
              className="h-7 font-mono text-xs"
              value={hexDraft}
              onChange={(event) => {
                setHexDraft(event.target.value);
                const parsed = parseColour(event.target.value);
                if (!parsed) return;
                const next = { ...parsed, a: alpha };
                setRgbDraft(formatRgbChannels(next));
                const h = hexToHsl(formatHex(next));
                setHue(h.h);
                setSat(h.s);
                setLight(h.l);
                commitRgba(next);
              }}
            />
            <span className="text-muted-foreground">{t("protoColourRgb")}</span>
            <Input
              className="h-7 font-mono text-xs"
              value={rgbDraft}
              onChange={(event) => {
                setRgbDraft(event.target.value);
                const parsed = parseRgbChannels(event.target.value, alpha);
                if (!parsed) return;
                setHexDraft(formatHex(parsed));
                const h = hexToHsl(formatHex(parsed));
                setHue(h.h);
                setSat(h.s);
                setLight(h.l);
                commitRgba(parsed);
              }}
            />
          </div>
          {docColours.length ? (
            <div className="mt-2">
              <div className="mb-1 text-xs text-muted-foreground">{t("protoColourDocument")}</div>
              <div className="grid grid-cols-7 gap-1">
                {docColours.map((preset) => (
                  <ColourChip key={preset} colour={preset} active={value === preset} onPick={() => onChange(preset)} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-2">
            <div className="mb-1 text-xs text-muted-foreground">{t("protoColourPresets")}</div>
            <div className="grid grid-cols-5 gap-1">
              {INSPECTOR_COLOUR_PRESETS.map((preset) => (
                <ColourChip
                  key={preset}
                  colour={preset}
                  active={value === preset}
                  onPick={() => onChange(preset)}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-1">
            <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={() => onChange("transparent")}>
              {t("protoColourNone")}
            </Button>
            {typeof globalThis.window !== "undefined" && (window as Window & { EyeDropper?: unknown }).EyeDropper ? (
              <Button type="button" variant="outline" size="icon" className="size-7 shrink-0" aria-label={t("protoColourEyedropper")} onClick={pickEyedropper}>
                <Icon name="Target" className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ColourChip({ colour, active, onPick }: { colour: string; active: boolean; onPick: () => void }) {
  const transparent = colour === "transparent";
  return (
    <button
      type="button"
      className={cn("size-6 rounded border border-border", active && "ring-2 ring-ring")}
      style={{ background: transparent ? CHECKERBOARD_BG : colour }}
      onClick={onPick}
    />
  );
}
