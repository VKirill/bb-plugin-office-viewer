import {
  appendHistoryEntry,
  historyIndexPath,
  historySnapshotPath,
  newSnapshotId,
  parseHistoryIndex,
  type WireframeHistoryEntry,
  type WireframeHistoryReason,
} from "./wireframe-history.ts";
import type { Lang } from "./locate.ts";

type FilesApi = {
  read: (args: { hostId: string; path: string }) => Promise<{ content?: string; contentEncoding?: string } | Record<string, never>>;
  write: (args: {
    hostId: string;
    path: string;
    content: string;
    contentEncoding: "utf8" | "base64";
    createParents?: boolean;
  }) => Promise<unknown>;
};

export async function readHistoryIndex(
  files: FilesApi,
  hostId: string,
  prototypesRoot: string,
  stem: string,
  lang: Lang,
): Promise<{ stem: string; entries: WireframeHistoryEntry[] }> {
  const path = historyIndexPath(prototypesRoot, stem, lang);
  try {
    const file = await files.read({ hostId, path });
    if (!("content" in file) || !file.content) return { stem, entries: [] };
    const text = file.contentEncoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;
    return parseHistoryIndex(text, stem);
  } catch {
    return { stem, entries: [] };
  }
}

export async function appendWireframeHistorySnapshot(
  files: FilesApi,
  hostId: string,
  prototypesRoot: string,
  stem: string,
  json: string,
  reason: WireframeHistoryReason,
  lang: Lang,
): Promise<string> {
  const id = newSnapshotId();
  const entry: WireframeHistoryEntry = { id, createdAt: Number(id), reason };
  const index = appendHistoryEntry(await readHistoryIndex(files, hostId, prototypesRoot, stem, lang), entry);
  const snapPath = historySnapshotPath(prototypesRoot, stem, id, lang);
  const indexPath = historyIndexPath(prototypesRoot, stem, lang);
  await files.write({ hostId, path: snapPath, content: json, contentEncoding: "utf8", createParents: true });
  await files.write({ hostId, path: indexPath, content: JSON.stringify(index), contentEncoding: "utf8", createParents: true });
  return id;
}
