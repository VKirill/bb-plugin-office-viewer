import { z } from "zod";
import { within, type Lang } from "./locate.ts";

export const WIREFRAME_PUBLISH_FOLDER = ".publish";

export const publishIndexSchema = z
  .object({
    stem: z.string().min(1).max(200),
    threadId: z.string().min(1).max(256),
    published: z.boolean(),
    updatedAt: z.number().finite(),
  })
  .strict();

export type WireframePublishIndex = z.infer<typeof publishIndexSchema>;

export function publishStemDir(prototypesDir: string, stem: string, lang: Lang = "en"): string {
  return within(prototypesDir, `${WIREFRAME_PUBLISH_FOLDER}/${stem}`, lang);
}

export function publishIndexPath(prototypesDir: string, stem: string, lang: Lang = "en"): string {
  return within(prototypesDir, `${WIREFRAME_PUBLISH_FOLDER}/${stem}/index.json`, lang);
}

export function publishPlayerPath(prototypesDir: string, stem: string, lang: Lang = "en"): string {
  return within(prototypesDir, `${WIREFRAME_PUBLISH_FOLDER}/${stem}/index.html`, lang);
}

export function publishDataPath(prototypesDir: string, stem: string, lang: Lang = "en"): string {
  return within(prototypesDir, `${WIREFRAME_PUBLISH_FOLDER}/${stem}/data.json`, lang);
}

export function parsePublishIndex(raw: string, stem: string): WireframePublishIndex {
  const parsed = publishIndexSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return { stem, threadId: "", published: false, updatedAt: 0 };
  }
  return parsed.data;
}
