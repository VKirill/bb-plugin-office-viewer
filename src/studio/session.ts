import { useSyncExternalStore } from "react";
import { parsePaintDoc, type PaintDoc } from "./paint/paint-model.ts";
import { parseWireframe, type Wireframe } from "./prototype/model.ts";
import { parseSlidesDeck, type SlidesDeck } from "./slides/model.ts";
import type { StudioTool } from "./studio-tool.ts";

const STORAGE_PREFIX = "office-studio.session.";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type PrototypeSession = {
  doc: Wireframe;
  openedStem: string | null;
  zoom: number;
  selected: string[];
  openTabIds: string[];
};

export type SlidesSession = {
  deck: SlidesDeck;
  openedStem: string | null;
  zoom: number;
  selected: string[];
};

export type PaintSession = {
  doc: PaintDoc;
  openedStem: string | null;
  editorOpen: boolean;
};

export type ThreadSession = {
  v: 1;
  tool: StudioTool | null;
  prototype?: PrototypeSession;
  slides?: SlidesSession;
  paint?: PaintSession;
};

const memory = new Map<string, ThreadSession>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function emptySession(): ThreadSession {
  return { v: 1, tool: null };
}

function clampZoom(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(8, Math.max(0.05, value));
}

function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 400);
}

export function parseThreadSession(input: unknown): ThreadSession | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (raw.v !== 1) return null;
  const tool = raw.tool === "prototype" || raw.tool === "paint" || raw.tool === "slides" || raw.tool === null ? raw.tool : null;
  const next: ThreadSession = { v: 1, tool };
  if (raw.prototype && typeof raw.prototype === "object" && !Array.isArray(raw.prototype)) {
    const proto = raw.prototype as Record<string, unknown>;
    try {
      next.prototype = {
        doc: parseWireframe(proto.doc),
        openedStem: typeof proto.openedStem === "string" && proto.openedStem.length > 0 ? proto.openedStem : null,
        zoom: clampZoom(proto.zoom),
        selected: readIds(proto.selected),
        openTabIds: readIds(proto.openTabIds),
      };
    } catch {
      /* drop a broken prototype snapshot */
    }
  }
  if (raw.slides && typeof raw.slides === "object" && !Array.isArray(raw.slides)) {
    const slides = raw.slides as Record<string, unknown>;
    try {
      next.slides = {
        deck: parseSlidesDeck(slides.deck),
        openedStem: typeof slides.openedStem === "string" && slides.openedStem.length > 0 ? slides.openedStem : null,
        zoom: clampZoom(slides.zoom),
        selected: readIds(slides.selected),
      };
    } catch {
      /* drop a broken slides snapshot */
    }
  }
  if (raw.paint && typeof raw.paint === "object" && !Array.isArray(raw.paint)) {
    const paint = raw.paint as Record<string, unknown>;
    try {
      next.paint = {
        doc: parsePaintDoc(paint.doc),
        openedStem: typeof paint.openedStem === "string" && paint.openedStem.length > 0 ? paint.openedStem : null,
        editorOpen: paint.editorOpen === true,
      };
    } catch {
      /* drop a broken paint snapshot */
    }
  }
  return next;
}

function persist(threadId: string, session: ThreadSession): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_PREFIX + threadId, JSON.stringify(session));
  } catch {
    /* private mode or quota */
  }
}

function load(threadId: string): ThreadSession {
  const cached = memory.get(threadId);
  if (cached) return cached;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + threadId);
    const parsed = raw ? parseThreadSession(JSON.parse(raw)) : null;
    const session = parsed ?? emptySession();
    memory.set(threadId, session);
    return session;
  } catch {
    const session = emptySession();
    memory.set(threadId, session);
    return session;
  }
}

export function readThreadSession(threadId: string): ThreadSession {
  return load(threadId);
}

export function writeThreadSession(threadId: string, session: ThreadSession): void {
  memory.set(threadId, session);
  persist(threadId, session);
  emit();
}

export function patchThreadSession(threadId: string, patch: Partial<Omit<ThreadSession, "v">>): void {
  const was = load(threadId);
  writeThreadSession(threadId, { ...was, ...patch, v: 1 });
}

export function subscribeThreadSessions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useThreadSession(threadId: string): ThreadSession {
  return useSyncExternalStore(subscribeThreadSessions, () => readThreadSession(threadId), () => readThreadSession(threadId));
}

export function autosaveLabelKey(status: AutosaveStatus): "saving" | "saved" | "unsavedChanges" | "studioAutosaveFailed" | null {
  if (status === "idle") return null;
  if (status === "saving") return "saving";
  if (status === "saved") return "saved";
  if (status === "error") return "studioAutosaveFailed";
  return "unsavedChanges";
}
