// bb-plugin-office-viewer — server: locate a spreadsheet on the machine that
// owns it and hand its bytes to the viewer.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import * as XLSX from "xlsx";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { locate, LocateError, type Lang, type LocateSdk } from "./locate.ts";
import { applyCsvEdits, parseCsv, serializeCsv } from "./csv.ts";
import { editMode, extensionOf } from "./sheet.ts";
import { PatchError, patchXlsx, type CellEdit } from "./xlsx-patch.ts";

const say = (lang: Lang, en: string, ru: string) => (lang === "ru" ? ru : en);

export const MAX_BYTES = 30 * 1024 * 1024;

const sourceSchema = z
  .object({
    kind: z.enum(["host", "thread-storage", "workspace"]),
    threadId: z.string().max(256).nullable(),
    environmentId: z.string().max(256).nullable(),
    projectId: z.string().max(256).nullable(),
    hostId: z.string().max(256).nullable().optional(),
  })
  .strict();

const fileSchema = z.object({ source: sourceSchema, path: z.string().min(1).max(8192), locale: z.enum(["en", "ru"]).optional() }).strict();

const position = { row: z.number().int().min(0).max(1_048_575), col: z.number().int().min(0).max(16_383) };
const editSchema = z.discriminatedUnion("kind", [
  z.object({ ...position, kind: z.literal("string"), text: z.string().max(32_767) }).strict(),
  z.object({ ...position, kind: z.literal("number"), value: z.number().finite() }).strict(),
  z.object({ ...position, kind: z.literal("boolean"), value: z.boolean() }).strict(),
  z.object({ ...position, kind: z.literal("formula"), formula: z.string().min(1).max(8192) }).strict(),
  z.object({ ...position, kind: z.literal("clear") }).strict(),
]);

export const rpcContract = defineRpcContract({
  open: {
    input: fileSchema,
    output: z
      .object({
        base64: z.string(),
        sizeBytes: z.number(),
        sha256: z.string(),
        hostName: z.string(),
        absPath: z.string(),
      })
      .strict(),
  },
  /** The IronCalc WebAssembly module the viewer computes formulas with. */
  engine: { input: z.object({}).strict(), output: z.object({ base64: z.string() }).strict() },
  save: {
    input: fileSchema
      .extend({
        expectedSha256: z.string(),
        sheet: z.object({ index: z.number().int().min(0), name: z.string() }).strict(),
        edits: z.array(editSchema).min(1).max(50_000),
      })
      .strict(),
    output: z.discriminatedUnion("outcome", [
      z.object({ outcome: z.literal("written"), sha256: z.string(), sizeBytes: z.number() }).strict(),
      z.object({ outcome: z.literal("conflict") }).strict(),
    ]),
  },
});

/** Formula text SheetJS expands for a dependent of a shared formula. */
function sharedFormulaExpander(bytes: Uint8Array) {
  let book: XLSX.WorkBook | null = null;
  return (sheetIndex: number, ref: string) => {
    book ??= XLSX.read(bytes, { type: "array", cellFormula: true, cellNF: false, cellHTML: false, cellText: false });
    const cell = book.Sheets[book.SheetNames[sheetIndex]]?.[ref] as XLSX.CellObject | undefined;
    return cell?.f ?? null;
  };
}

export function applyEdits(bytes: Uint8Array, extension: string, sheet: { index: number; name: string }, edits: CellEdit[]): Uint8Array {
  const mode = editMode(extension);
  if (mode === "xlsx") return patchXlsx(bytes, sheet, edits, sharedFormulaExpander(bytes));
  if (mode === "csv") {
    const text = (edit: CellEdit) =>
      edit.kind === "clear" ? "" : edit.kind === "string" ? edit.text : edit.kind === "formula" ? `=${edit.formula}` : String(edit.value);
    return serializeCsv(applyCsvEdits(parseCsv(bytes, extension), edits.map((edit) => ({ row: edit.row, col: edit.col, text: text(edit) }))));
  }
  throw new PatchError(`.${extension} files are read-only.`);
}

function describe(error: unknown, hostName: string, absPath: string, lang: Lang): Error {
  if (error instanceof LocateError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/does not exist|ENOENT|404/i.test(message)) {
    return new Error(say(lang, `File not found on “${hostName}”: ${absPath}`, `Файл не найден на машине «${hostName}»: ${absPath}`));
  }
  if (/offline|not connected|unreachable|ECONNREFUSED/i.test(message)) {
    return new Error(say(lang, `Machine “${hostName}” is unavailable: ${message}`, `Машина «${hostName}» недоступна: ${message}`));
  }
  return new Error(message);
}

export default function plugin(bb: BbPluginApi) {
  const sdk = bb.sdk as unknown as LocateSdk;
  let engine: Promise<string> | null = null;

  bb.rpc.register(rpcContract, {
    engine: async () => {
      engine ??= readFile(createRequire(import.meta.url).resolve("@ironcalc/wasm/wasm_bg.wasm")).then((bytes) => bytes.toString("base64"));
      try {
        return { base64: await engine };
      } catch (error) {
        engine = null;
        throw error;
      }
    },
    open: async ({ source, path, locale = "en" }) => {
      const where = await locate(sdk, source, path, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: where.hostId }).catch(() => null))?.name || where.hostId;
      const file = await bb.sdk.files
        .read({ hostId: where.hostId, path: where.absPath })
        .catch((error: unknown) => { throw describe(error, hostName, where.absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      if (file.sizeBytes > MAX_BYTES) throw new Error(say(locale, "The file is larger than 30 MB.", "Файл больше 30 МБ."));
      const base64 = file.contentEncoding === "base64" ? file.content : Buffer.from(file.content, "utf8").toString("base64");
      return { base64, sizeBytes: file.sizeBytes, sha256: file.sha256, hostName, absPath: where.absPath };
    },
    save: async ({ source, path, locale = "en", expectedSha256, sheet, edits }) => {
      const where = await locate(sdk, source, path, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: where.hostId }).catch(() => null))?.name || where.hostId;
      const file = await bb.sdk.files
        .read({ hostId: where.hostId, path: where.absPath })
        .catch((error: unknown) => { throw describe(error, hostName, where.absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      if (file.sha256 !== expectedSha256) return { outcome: "conflict" as const };
      const bytes = new Uint8Array(Buffer.from(file.content, file.contentEncoding === "base64" ? "base64" : "utf8"));
      let next: Uint8Array;
      try {
        next = applyEdits(bytes, extensionOf(where.absPath), sheet, edits);
      } catch (error) {
        if (error instanceof PatchError) throw new Error(say(locale, `Can't save: ${error.message}`, `Не удалось сохранить: ${error.message}`));
        throw error;
      }
      const result = await bb.sdk.files
        .write({ hostId: where.hostId, path: where.absPath, content: Buffer.from(next).toString("base64"), contentEncoding: "base64", expectedSha256 })
        .catch((error: unknown) => { throw describe(error, hostName, where.absPath, locale); });
      if (result.outcome === "conflict") return { outcome: "conflict" as const };
      bb.log.info(`saved ${edits.length} edit(s) to ${where.hostId}:${where.absPath}`);
      return { outcome: "written" as const, sha256: result.sha256, sizeBytes: next.byteLength };
    },
  });
}
