import type { IconSvgElement } from "@hugeicons/react";
import { HUGEICON_NAMES } from "../studio/prototype/hugeicons-names.ts";

const VALID_NAMES = new Set<string>(HUGEICON_NAMES);

export const HUGEICON_BATCH_MAX = 64;

export function filterHugeiconNames(names: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (!VALID_NAMES.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= HUGEICON_BATCH_MAX) break;
  }
  return out;
}

export async function loadHugeiconsByNames(names: readonly string[]): Promise<Record<string, IconSvgElement>> {
  const wanted = filterHugeiconNames(names);
  const icons: Record<string, IconSvgElement> = {};
  await Promise.all(
    wanted.map(async (name) => {
      try {
        const mod = await import(`@hugeicons/core-free-icons/${name}`);
        const icon = (mod as { default?: IconSvgElement }).default;
        if (icon !== undefined) icons[name] = icon;
      } catch {
        // Unknown or missing export — skip.
      }
    }),
  );
  return icons;
}
