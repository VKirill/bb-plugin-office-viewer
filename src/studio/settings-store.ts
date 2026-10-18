import { useSyncExternalStore } from "react";
import { setLanguagePref, type LanguagePref } from "../shared/i18n.ts";
import { PAINT_SIZES } from "./paint/paint-model";
import type { CanvasPresetId } from "./prototype/model";

const STORAGE_KEY = "office-studio.settings";
const GRID_STEPS = [5, 8, 10] as const;
const PRESETS: CanvasPresetId[] = ["desktop", "desktopWide", "tablet", "tabletLandscape", "phone", "phoneLarge"];

export type GridStep = (typeof GRID_STEPS)[number];

export type ProtoFidelity = "sketch" | "mockup";

export type StudioSettings = {
  language: LanguagePref;
  protoPreset: CanvasPresetId;
  protoGridStep: GridStep;
  protoShowGrid: boolean;
  protoSnap: boolean;
  protoBadges: boolean;
  protoFidelity: ProtoFidelity;
  protoMinimap: boolean;
  protoTourDone: boolean;
  paintColor: string;
  paintSize: number;
};

const DEFAULTS: StudioSettings = {
  language: "auto",
  protoPreset: "desktop",
  protoGridStep: 8,
  protoShowGrid: true,
  protoSnap: true,
  protoBadges: true,
  protoFidelity: "mockup",
  protoMinimap: true,
  protoTourDone: false,
  paintColor: "#ef4444",
  paintSize: 4,
};

const listeners = new Set<() => void>();
let state: StudioSettings = load();
setLanguagePref(state.language);

function load(): StudioSettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    return {
      language: parsed.language === "en" || parsed.language === "ru" || parsed.language === "auto" ? parsed.language : DEFAULTS.language,
      protoPreset: PRESETS.includes(parsed.protoPreset as CanvasPresetId) ? (parsed.protoPreset as CanvasPresetId) : DEFAULTS.protoPreset,
      protoGridStep: GRID_STEPS.includes(parsed.protoGridStep as GridStep) ? (parsed.protoGridStep as GridStep) : DEFAULTS.protoGridStep,
      protoShowGrid: typeof parsed.protoShowGrid === "boolean" ? parsed.protoShowGrid : DEFAULTS.protoShowGrid,
      protoSnap: typeof parsed.protoSnap === "boolean" ? parsed.protoSnap : DEFAULTS.protoSnap,
      protoBadges: typeof parsed.protoBadges === "boolean" ? parsed.protoBadges : DEFAULTS.protoBadges,
      protoFidelity: parsed.protoFidelity === "sketch" || parsed.protoFidelity === "mockup" ? parsed.protoFidelity : DEFAULTS.protoFidelity,
      protoMinimap: typeof parsed.protoMinimap === "boolean" ? parsed.protoMinimap : DEFAULTS.protoMinimap,
      protoTourDone: typeof parsed.protoTourDone === "boolean" ? parsed.protoTourDone : DEFAULTS.protoTourDone,
      paintColor: typeof parsed.paintColor === "string" && parsed.paintColor.length > 0 ? parsed.paintColor : DEFAULTS.paintColor,
      paintSize: typeof parsed.paintSize === "number" && (PAINT_SIZES as readonly number[]).includes(parsed.paintSize) ? parsed.paintSize : DEFAULTS.paintSize,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(next: StudioSettings): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

export function getStudioSettings(): StudioSettings {
  return state;
}

export function subscribeStudioSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function patchStudioSettings(partial: Partial<StudioSettings>): void {
  state = { ...state, ...partial };
  persist(state);
  if (partial.language !== undefined) setLanguagePref(state.language);
  emit();
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function useStudioSettings(): StudioSettings {
  return useSyncExternalStore(subscribeStudioSettings, getStudioSettings, getStudioSettings);
}
