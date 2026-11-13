import { z } from "zod";

/** Coordinates are relative to a page, so resizing the panel keeps the same passage visible. */
export const pdfViewStateSchema = z.object({
  page: z.number().int().min(0).max(1_000_000),
  fraction: z.number().finite().min(0).max(1),
  horizontal: z.number().finite().min(0).max(1),
  zoom: z.union([z.literal("width"), z.literal("page"), z.number().finite().min(0.075).max(4.5)]),
}).strict();

export type PdfViewState = z.infer<typeof pdfViewStateSchema>;

/** Debounce scrolling, serialize writes, and flush the last position when the panel closes. */
export function createViewStateSaver(write: (state: PdfViewState) => Promise<unknown>, onError: (error: unknown) => void, delay = 400) {
  let pending: PdfViewState | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> | null = null;
  let latest: PdfViewState | null = null;

  const flush = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    if (writing) return writing.then(flush);
    const state = pending;
    if (!state) return Promise.resolve();
    pending = null;
    writing = Promise.resolve().then(() => write(state)).then(() => {}, onError).finally(() => { writing = null; });
    return writing.then(flush);
  };

  return {
    update(state: PdfViewState) {
      pending = latest = { ...state };
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    flush,
    async restore(read: () => Promise<PdfViewState | null>, timeout = 1500): Promise<PdfViewState | null> {
      if (latest) return { ...latest };
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        const saved = await Promise.race([
          read(),
          new Promise<null>((resolve) => { deadline = setTimeout(() => resolve(null), timeout); }),
        ]);
        return latest ?? saved;
      } catch (error) {
        onError(error);
        return null;
      } finally {
        clearTimeout(deadline);
      }
    },
  };
}

// Keep one queue while a file is open or its closing write is still in flight.
const sessions = new Map<string, { saver: ReturnType<typeof createViewStateSaver>; users: number }>();

export function acquireViewStateSaver(key: string, write: (state: PdfViewState) => Promise<unknown>, onError: (error: unknown) => void) {
  let session = sessions.get(key);
  if (!session) {
    session = { saver: createViewStateSaver(write, onError), users: 0 };
    sessions.set(key, session);
  }
  const shared = session;
  shared.users++;
  return {
    ...shared.saver,
    async release() {
      shared.users--;
      await shared.saver.flush();
      if (!shared.users && sessions.get(key) === shared) sessions.delete(key);
    },
  };
}
