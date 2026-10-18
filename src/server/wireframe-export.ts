import type { Lang } from "./locate.ts";
import { within } from "./locate.ts";
import { prototypesDir } from "./wireframes.ts";

export function wireframeSpecPath(dir: string, stem: string, lang: Lang = "en"): string {
  return within(dir, `${stem}.spec.md`, lang);
}

export function wireframeCodeReadmePath(dir: string, stem: string, lang: Lang = "en"): string {
  return within(dir, `${stem}.code/README.md`, lang);
}

export function wireframeCodeFilePath(dir: string, stem: string, fileName: string, lang: Lang = "en"): string {
  const base = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  if (!base || base.includes("..")) {
    throw new Error(lang === "ru" ? "Некорректное имя файла." : "Invalid file name.");
  }
  return within(dir, `${stem}.code/${base}`, lang);
}

export function wireframeSpecAssetPath(dir: string, relPath: string, lang: Lang = "en"): string {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return within(dir, normalized, lang);
}
