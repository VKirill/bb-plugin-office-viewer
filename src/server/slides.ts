import { within, type Lang } from "./locate.ts";

export const SLIDES_FOLDER = "Slides";
export const SLIDES_SUFFIX = ".slides.json";
export const PNG_SUFFIX = ".png";

const say = (lang: Lang, en: string, ru: string) => (lang === "ru" ? ru : en);

export function sanitizeSlidesStem(name: string, lang: Lang = "en"): string {
  let stem = name.trim();
  if (stem.toLowerCase().endsWith(SLIDES_SUFFIX)) stem = stem.slice(0, -SLIDES_SUFFIX.length);
  else if (stem.toLowerCase().endsWith(".json")) stem = stem.slice(0, -5);
  if (stem.toLowerCase().endsWith(PNG_SUFFIX)) stem = stem.slice(0, -PNG_SUFFIX.length);
  stem = stem.trim();
  if (!stem || stem.startsWith(".") || /[\\/]/.test(stem) || stem.includes("..")) {
    throw new Error(say(lang, "Invalid file name.", "Некорректное имя файла."));
  }
  return stem.slice(0, 200);
}

export function slidesDir(storageRoot: string, lang: Lang = "en"): string {
  return within(storageRoot, SLIDES_FOLDER, lang);
}

export function slidesJsonPath(dir: string, stem: string, lang: Lang = "en"): string {
  return within(dir, `${stem}${SLIDES_SUFFIX}`, lang);
}

export function slidesPngPath(dir: string, stem: string, lang: Lang = "en"): string {
  return within(dir, `${stem}${PNG_SUFFIX}`, lang);
}

export function listedSlidesStem(fileName: string): string | null {
  const base = fileName.includes("/") ? fileName.slice(fileName.lastIndexOf("/") + 1) : fileName;
  if (!base.endsWith(SLIDES_SUFFIX) || base.includes("/") || base.startsWith(".")) return null;
  return base.slice(0, -SLIDES_SUFFIX.length);
}

export function freeSlidesStem(dir: string, stem: string, existence: Record<string, boolean>, lang: Lang = "en"): string {
  const candidates = [stem, ...Array.from({ length: 98 }, (_, i) => `${stem}-${i + 2}`)];
  const found = candidates.find((name) => existence[slidesJsonPath(dir, name, lang)] === false);
  if (!found) throw new Error(say(lang, "No free file name left.", "Не нашлось свободного имени файла."));
  return found;
}
