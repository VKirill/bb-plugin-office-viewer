import type { IconSvgElement } from "@hugeicons/react";

const listeners = new Set<() => void>();

let iconNames: readonly string[] | null = null;
const iconsByName = new Map<string, IconSvgElement>();
let catalogPromise: Promise<void> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeHugeiconsCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHugeiconsCatalogSnapshot(): readonly string[] | null {
  return iconNames;
}

export function getHugeiconSvg(name: string): IconSvgElement | undefined {
  return iconsByName.get(name);
}

export function preloadHugeiconsCatalog(): Promise<void> {
  catalogPromise ??= import("./hugeicons-names.ts")
    .then((mod) => {
      iconNames = mod.HUGEICON_NAMES;
      notify();
    })
    .catch((error: unknown) => {
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
}

export function ensureHugeiconLoaded(name: string): Promise<IconSvgElement | undefined> {
  const cached = iconsByName.get(name);
  if (cached !== undefined) return Promise.resolve(cached);
  return import(
    /* @vite-ignore */
    `@hugeicons/core-free-icons/${name}`
  )
    .then((mod) => {
      const icon = (mod as Record<string, IconSvgElement>)[name];
      if (icon !== undefined) iconsByName.set(name, icon);
      notify();
      return icon;
    })
    .catch((error: unknown) => {
      throw error;
    });
}
