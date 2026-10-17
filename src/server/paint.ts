import { within, type Lang } from "./locate.ts";

export const PAINT_FOLDER = "Paint";
export const PAINT_SUFFIX = ".paint.json";
export const PNG_SUFFIX = ".png";

const say = (lang: Lang, en: string, ru: string) => (lang === "ru" ? ru : en);

/** File stem for a drawing: no path, no leading dot, suffixes stripped. */
export function sanitizePaintStem(name: string, lang: Lang = "en"): string {
  let stem = name.trim();
  if (stem.toLowerCase().endsWith(PAINT_SUFFIX)) stem = stem.slice(0, -PAINT_SUFFIX.length);
  else if (stem.toLowerCase().endsWith(".json")) stem = stem.slice(0, -5);
  if (stem.toLowerCase().endsWith(PNG_SUFFIX)) stem = stem.slice(0, -PNG_SUFFIX.length);
  stem = stem.trim();
  if (!stem || stem.startsWith(".") || /[\\/]/.test(stem) || stem.includes("..")) {
    throw new Error(say(lang, "Invalid file name.", "Некорректное имя файла."));
  }
  return stem.slice(0, 200);
}

export function paintDir(storageRoot: string, lang: Lang = "en"): string {
  return within(storageRoot, PAINT_FOLDER, lang);
}

export function paintJsonPath(dir: string, stem: string, lang: Lang = "en"): string {
  return within(dir, `${stem}${PAINT_SUFFIX}`, lang);
}

export function paintPngPath(dir: string, stem: string, lang: Lang = "en"): string {
  return within(dir, `${stem}${PNG_SUFFIX}`, lang);
}

export function listedPaintStem(fileName: string): string | null {
  const base = fileName.includes("/") ? fileName.slice(fileName.lastIndexOf("/") + 1) : fileName;
  if (!base.endsWith(PAINT_SUFFIX) || base.includes("/") || base.startsWith(".")) return null;
  return base.slice(0, -PAINT_SUFFIX.length);
}

/** First stem whose json file is free; `stem`, then `stem-2` … `stem-99`. */
export function freePaintStem(dir: string, stem: string, existence: Record<string, boolean>, lang: Lang = "en"): string {
  const candidates = [stem, ...Array.from({ length: 98 }, (_, i) => `${stem}-${i + 2}`)];
  const found = candidates.find((name) => existence[paintJsonPath(dir, name, lang)] === false);
  if (!found) throw new Error(say(lang, "No free file name left.", "Не нашлось свободного имени файла."));
  return found;
}
