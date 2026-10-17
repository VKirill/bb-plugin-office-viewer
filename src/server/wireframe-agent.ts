import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { within, type Lang } from "./locate.ts";
import { PROTOTYPES_FOLDER, prototypesDir } from "./wireframes.ts";

export const WIREFRAME_SCHEMA_MD = "WIREFRAME_SCHEMA.md";
export const WIREFRAME_SCHEMA_JSON = "wireframe.schema.json";
export const PROTOTYPE_REFS_DIR = "refs";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export function wireframeSchemaMdPath(dir: string, lang: Lang = "en"): string {
  return within(dir, WIREFRAME_SCHEMA_MD, lang);
}

export function wireframeSchemaJsonPath(dir: string, lang: Lang = "en"): string {
  return within(dir, WIREFRAME_SCHEMA_JSON, lang);
}

export function prototypeRefPath(dir: string, fileName: string, lang: Lang = "en"): string {
  const base = fileName.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  if (!base || base.startsWith(".") || base.includes("..")) {
    throw new Error(lang === "ru" ? "Некорректное имя файла." : "Invalid file name.");
  }
  return within(dir, `${PROTOTYPE_REFS_DIR}/${base}`, lang);
}

export function hashUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

type FilesApi = {
  read: (args: { hostId: string; path: string }) => Promise<{ content?: string; contentEncoding?: string }>;
  write: (args: { hostId: string; path: string; content: string; contentEncoding: "utf8" | "base64"; createParents?: boolean }) => Promise<unknown>;
};

export async function ensureWireframeAgentSchema(
  files: FilesApi,
  hostId: string,
  storageRoot: string,
  pathsExist: (paths: string[]) => Promise<Record<string, boolean>>,
  lang: Lang = "en",
): Promise<{ schemaMdPath: string; schemaJsonPath: string; prototypesDir: string }> {
  const dir = prototypesDir(storageRoot, lang);
  const mdPath = wireframeSchemaMdPath(dir, lang);
  const jsonPath = wireframeSchemaJsonPath(dir, lang);
  const existence = await pathsExist([mdPath, jsonPath]);
  const bundledMd = await readFile(join(pluginRoot, "studio/prototype/WIREFRAME_SCHEMA.md"), "utf8");
  const bundledJson = await readFile(join(pluginRoot, "studio/prototype/wireframe.schema.json"), "utf8");
  if (!existence[mdPath]) {
    await files.write({ hostId, path: mdPath, content: bundledMd, contentEncoding: "utf8", createParents: true });
  }
  if (!existence[jsonPath]) {
    await files.write({ hostId, path: jsonPath, content: bundledJson, contentEncoding: "utf8", createParents: true });
  }
  return { schemaMdPath: mdPath, schemaJsonPath: jsonPath, prototypesDir: dir };
}

export function prototypesFolderLabel(): string {
  return PROTOTYPES_FOLDER;
}
