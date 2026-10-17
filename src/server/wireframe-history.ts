import { z } from "zod";
import { within, type Lang } from "./locate.ts";

export const WIREFRAME_HISTORY_FOLDER = ".wireframe-history";
export const MAX_WIREFRAME_HISTORY = 50;

export const wireframeHistoryReasons = ["save", "autosave", "risky"] as const;
export type WireframeHistoryReason = (typeof wireframeHistoryReasons)[number];

export type WireframeHistoryEntry = {
  id: string;
  createdAt: number;
  reason: WireframeHistoryReason;
};

export const wireframeHistoryIndexSchema = z
  .object({
    stem: z.string().min(1).max(200),
    entries: z.array(
      z
        .object({
          id: z.string().min(1).max(128),
          createdAt: z.number().finite(),
          reason: z.enum(wireframeHistoryReasons),
        })
        .strict(),
    ),
  })
  .strict();

export function historyStemDir(prototypesDir: string, stem: string, lang: Lang = "en"): string {
  return within(prototypesDir, `${WIREFRAME_HISTORY_FOLDER}/${stem}`, lang);
}

export function historyIndexPath(prototypesDir: string, stem: string, lang: Lang = "en"): string {
  return within(prototypesDir, `${WIREFRAME_HISTORY_FOLDER}/${stem}/index.json`, lang);
}

export function historySnapshotPath(prototypesDir: string, stem: string, snapshotId: string, lang: Lang = "en"): string {
  return within(prototypesDir, `${WIREFRAME_HISTORY_FOLDER}/${stem}/${snapshotId}.wireframe.json`, lang);
}

export function newSnapshotId(createdAt = Date.now()): string {
  return String(createdAt);
}

export function pruneWireframeHistory(entries: readonly WireframeHistoryEntry[], max = MAX_WIREFRAME_HISTORY): WireframeHistoryEntry[] {
  return [...entries].sort((a, b) => b.createdAt - a.createdAt).slice(0, max);
}

export function appendHistoryEntry(
  index: { stem: string; entries: WireframeHistoryEntry[] },
  entry: WireframeHistoryEntry,
  max = MAX_WIREFRAME_HISTORY,
): { stem: string; entries: WireframeHistoryEntry[] } {
  const withoutDup = index.entries.filter((item) => item.id !== entry.id);
  return { stem: index.stem, entries: pruneWireframeHistory([entry, ...withoutDup], max) };
}

export function parseHistoryIndex(raw: string, stem: string): { stem: string; entries: WireframeHistoryEntry[] } {
  try {
    const parsed = wireframeHistoryIndexSchema.parse(JSON.parse(raw));
    if (parsed.stem !== stem) return { stem, entries: parsed.entries };
    return parsed;
  } catch {
    return { stem, entries: [] };
  }
}
