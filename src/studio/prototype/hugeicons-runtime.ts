import type { IconSvgElement } from "@hugeicons/react";

const HUGEICONS_BATCH_URL = "/api/v1/plugins/office-viewer/http/prototype/hugeicons";
const BATCH_MAX = 64;

const listeners = new Set<() => void>();

let iconNames: readonly string[] | null = null;
const iconsByName = new Map<string, IconSvgElement>();
let catalogPromise: Promise<void> | null = null;

type Waiter = { resolve: (icon: IconSvgElement | undefined) => void; reject: (error: unknown) => void };
const waitersByName = new Map<string, Waiter[]>();
const pendingNames = new Set<string>();
let flushPromise: Promise<void> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function settle(name: string, icon: IconSvgElement | undefined) {
  const waiters = waitersByName.get(name);
  if (!waiters) return;
  waitersByName.delete(name);
  for (const waiter of waiters) waiter.resolve(icon);
}

function settleError(name: string, error: unknown) {
  const waiters = waitersByName.get(name);
  if (!waiters) return;
  waitersByName.delete(name);
  for (const waiter of waiters) waiter.reject(error);
}

async function flushPending() {
  while (pendingNames.size > 0) {
    const batch = Array.from(pendingNames).slice(0, BATCH_MAX);
    for (const name of batch) pendingNames.delete(name);
    try {
      const response = await fetch(HUGEICONS_BATCH_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names: batch }),
      });
      if (!response.ok) throw new Error(`hugeicons ${response.status}`);
      const payload = (await response.json()) as { icons: Record<string, IconSvgElement> };
      const icons = payload.icons ?? {};
      for (const name of batch) {
        const icon = icons[name];
        if (icon !== undefined) iconsByName.set(name, icon);
        settle(name, icon);
      }
      notify();
    } catch (error) {
      for (const name of batch) settleError(name, error);
      throw error;
    }
  }
}

function scheduleFlush() {
  flushPromise ??= flushPending().finally(() => {
    flushPromise = null;
    if (pendingNames.size > 0) scheduleFlush();
  });
  return flushPromise;
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
  return new Promise((resolve, reject) => {
    const waiters = waitersByName.get(name) ?? [];
    waiters.push({ resolve, reject });
    waitersByName.set(name, waiters);
    pendingNames.add(name);
    void scheduleFlush().catch(() => undefined);
  });
}
