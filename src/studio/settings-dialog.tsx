import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { useT, type I18nKey, type LanguagePref } from "../shared/i18n";
import { PAINT_SIZES } from "./paint/paint-model";
import { CANVAS_PRESET_ENTRIES, type CanvasPresetId } from "./prototype/model";
import { patchStudioSettings, useStudioSettings, type GridStep } from "./settings-store";

export function StudioSettingsForm() {
  const t = useT();
  const settings = useStudioSettings();
  return (
    <div className="flex flex-col gap-4 text-sm">
      <fieldset className="grid gap-2">
        <legend className="text-xs font-medium text-muted-foreground">{t("studioLanguage")}</legend>
        {(["auto", "ru", "en"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="studio-language"
              checked={settings.language === value}
              onChange={() => patchStudioSettings({ language: value satisfies LanguagePref })}
            />
            {value === "auto" ? t("studioLanguageAuto") : value === "ru" ? t("studioLanguageRu") : t("studioLanguageEn")}
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="text-xs font-medium text-muted-foreground">{t("studioSettingsPrototype")}</legend>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("studioDefaultScreen")}</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2"
            value={settings.protoPreset}
            onChange={(event) => patchStudioSettings({ protoPreset: event.target.value as CanvasPresetId })}
          >
            {CANVAS_PRESET_ENTRIES.map((entry) => (
              <option key={entry.id} value={entry.id}>{t(entry.labelKey as I18nKey)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("studioGridStep")}</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2"
            value={settings.protoGridStep}
            onChange={(event) => patchStudioSettings({ protoGridStep: Number(event.target.value) as GridStep })}
          >
            {([5, 8, 10] as const).map((step) => (
              <option key={step} value={step}>{step} {t("studioUnitsPx")}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.protoShowGrid} onChange={(event) => patchStudioSettings({ protoShowGrid: event.target.checked })} />
          {t("studioShowGrid")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.protoSnap} onChange={(event) => patchStudioSettings({ protoSnap: event.target.checked })} />
          {t("studioSnapGrid")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.protoBadges} onChange={(event) => patchStudioSettings({ protoBadges: event.target.checked })} />
          {t("studioDefaultBadges")}
        </label>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="text-xs font-medium text-muted-foreground">{t("studioSettingsPaint")}</legend>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("studioBrushColor")}</span>
          <Input type="color" value={settings.paintColor} onChange={(event) => patchStudioSettings({ paintColor: event.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("studioBrushSize")}</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2"
            value={settings.paintSize}
            onChange={(event) => patchStudioSettings({ paintSize: Number(event.target.value) })}
          >
            {PAINT_SIZES.map((size) => (
              <option key={size} value={size}>{size} {t("studioUnitsPx")}</option>
            ))}
          </select>
        </label>
      </fieldset>
    </div>
  );
}

export function StudioSettingsButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <span title={t("studioSettings")} className="shrink-0">
        <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" aria-label={t("studioSettings")} onClick={() => setOpen(true)}>
          <Icon name="Settings" className="size-4" />
        </Button>
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("studioSettings")}</DialogTitle>
          </DialogHeader>
          <StudioSettingsForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
