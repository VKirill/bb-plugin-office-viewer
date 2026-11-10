import { createHash } from "node:crypto";
import { normalize } from "node:path";
import { pdfViewStateSchema, type PdfViewState } from "../pdf/view-state.ts";
import type { Location } from "./locate.ts";

type Store = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
};

/** Thread + resolved machine + path, independent of URL tokens and client device. */
export function pdfViewStateKey(threadId: string, location: Pick<Location, "hostId" | "absPath">): string {
  return "pdf-view:v1:" + createHash("sha256").update(JSON.stringify([threadId, location.hostId, normalize(location.absPath)])).digest("hex");
}

export async function readPdfViewState(store: Store, threadId: string, location: Location): Promise<PdfViewState | null> {
  const parsed = pdfViewStateSchema.safeParse(await store.get(pdfViewStateKey(threadId, location)));
  return parsed.success ? parsed.data : null;
}

export async function writePdfViewState(store: Store, threadId: string, location: Location, state: PdfViewState): Promise<void> {
  await store.set(pdfViewStateKey(threadId, location), pdfViewStateSchema.parse(state));
}
