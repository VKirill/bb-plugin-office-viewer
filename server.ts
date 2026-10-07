// bb-plugin-office-viewer — server: locate a spreadsheet on the machine that
// owns it and hand its bytes to the viewer.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import * as XLSX from "xlsx";
import WordExtractor from "word-extractor";
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
  z.object({ ...position, kind: z.literal("number"), value: z.number().finite(), format: z.string().min(1).max(255).optional() }).strict(),
  z.object({ ...position, kind: z.literal("boolean"), value: z.boolean() }).strict(),
  z.object({ ...position, kind: z.literal("formula"), formula: z.string().min(1).max(8192), format: z.string().min(1).max(255).optional() }).strict(),
  z.object({ ...position, kind: z.literal("clear") }).strict(),
]);

export const rpcContract = defineRpcContract({
  /** A short-lived URL the browser downloads the file from, so large files don't travel as JSON. */
  open: {
    input: fileSchema,
    output: z.object({ url: z.string(), hostName: z.string(), absPath: z.string() }).strict(),
  },
  /** Text of a legacy Word .doc: browsers have no renderer for the binary format. */
  docText: {
    input: fileSchema,
    output: z
      .object({ hostName: z.string(), absPath: z.string(), sizeBytes: z.number(), body: z.string(), headers: z.string(), footnotes: z.string(), endnotes: z.string() })
      .strict(),
  },
  /** The IronCalc WebAssembly module the viewer computes formulas with. */
  engine: { input: z.object({}).strict(), output: z.object({ base64: z.string() }).strict() },
  /** File names in the same folder, for stepping through images; sorted like Finder. */
  siblings: {
    input: fileSchema,
    output: z.object({ names: z.array(z.string()) }).strict(),
  },
  /** Writes an edited image: next to the original under a free name, or over it. */
  writeImage: {
    input: fileSchema
      .extend({ name: z.string().min(1).max(255), base64: z.string().max(60 * 1024 * 1024), overwrite: z.boolean() })
      .strict(),
    output: z.object({ name: z.string(), absPath: z.string(), sizeBytes: z.number() }).strict(),
  },
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

  // PDF.js for the PDF opener, fetched by the browser on the first PDF instead of riding in every app bundle.
  const require = createRequire(import.meta.url);
  const pdfjsVersion = (require("pdfjs-dist/package.json") as { version: string }).version;
  for (const name of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
    let body: Promise<Buffer> | null = null;
    bb.http.route("GET", `/pdfjs/${name}`, async (context) => {
      if (context.req.header("if-none-match") === `"${pdfjsVersion}"`) return new Response(null, { status: 304 });
      body ??= readFile(require.resolve(`pdfjs-dist/legacy/build/${name}`));
      return new Response(new Uint8Array(await body), {
        headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", etag: `"${pdfjsVersion}"` },
      });
    });
  }

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
    docText: async ({ source, path, locale = "en" }) => {
      const where = await locate(sdk, source, path, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: where.hostId }).catch(() => null))?.name || where.hostId;
      const file = await bb.sdk.files
        .read({ hostId: where.hostId, path: where.absPath })
        .catch((error: unknown) => { throw describe(error, hostName, where.absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      const bytes = Buffer.from(file.content, file.contentEncoding === "base64" ? "base64" : "utf8");
      if (bytes.byteLength > MAX_BYTES) throw new Error(say(locale, "The file is larger than 30 MB.", "Файл больше 30 МБ."));
      const doc = await new WordExtractor().extract(bytes).catch((error: unknown) => {
        throw new Error(say(locale, `Can't read the document: ${error instanceof Error ? error.message : String(error)}`, `Не удалось прочитать документ: ${error instanceof Error ? error.message : String(error)}`));
      });
      // The typings omit `filterUnicode`; left on, it turns dashes and typographic quotes into ASCII.
      const text = doc as unknown as Record<"getBody" | "getHeaders" | "getFootnotes" | "getEndnotes", (options: object) => string>;
      const raw = { filterUnicode: false };
      return {
        hostName,
        absPath: where.absPath,
        sizeBytes: bytes.byteLength,
        body: text.getBody(raw),
        headers: text.getHeaders({ ...raw, includeFooters: true }),
        footnotes: text.getFootnotes(raw),
        endnotes: text.getEndnotes(raw),
      };
    },
    open: async ({ source, path, locale = "en" }) => {
      const where = await locate(sdk, source, path, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: where.hostId }).catch(() => null))?.name || where.hostId;
      const exists = await bb.sdk.hosts.pathsExist({ hostId: where.hostId, paths: [where.absPath] }).catch(() => null);
      if (exists && exists.existence[where.absPath] === false) throw describe(new Error("ENOENT"), hostName, where.absPath, locale);
      const slash = where.absPath.lastIndexOf("/");
      const preview = await bb.sdk.files
        .createPreview({ hostId: where.hostId, rootPath: where.absPath.slice(0, slash) || "/", ttlMs: 10 * 60 * 1000 })
        .catch((error: unknown) => { throw describe(error, hostName, where.absPath, locale); });
      const url = `${preview.baseUrl.replace(/\/?$/, "/")}${encodeURIComponent(where.absPath.slice(slash + 1))}`;
      return { url, hostName, absPath: where.absPath };
    },
    siblings: async ({ source, path, locale = "en" }) => {
      const where = await locate(sdk, source, path, locale);
      const dir = where.absPath.slice(0, where.absPath.lastIndexOf("/")) || "/";
      const listed = await bb.sdk.files.list({ hostId: where.hostId, path: dir, limit: 5000, includeHidden: false });
      const names = listed.files
        .map((file) => (file.path.startsWith("/") ? file.path.slice(dir.length + 1) : file.path))
        .filter((name) => name && !name.includes("/"));
      names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      return { names };
    },
    writeImage: async ({ source, path, locale = "en", name, base64, overwrite }) => {
      if (name.includes("/") || name.startsWith(".")) throw new Error(say(locale, "Invalid file name.", "Некорректное имя файла."));
      const where = await locate(sdk, source, path, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: where.hostId }).catch(() => null))?.name || where.hostId;
      const dir = where.absPath.slice(0, where.absPath.lastIndexOf("/"));
      let target = `${dir}/${name}`;
      if (!overwrite) {
        const dot = name.lastIndexOf(".");
        const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
        const candidates = [target, ...Array.from({ length: 98 }, (_, i) => `${dir}/${stem}-${i + 2}${ext}`)];
        const { existence } = await bb.sdk.hosts.pathsExist({ hostId: where.hostId, paths: candidates });
        const free = candidates.find((candidate) => existence[candidate] === false);
        if (!free) throw new Error(say(locale, "No free file name left.", "Не нашлось свободного имени файла."));
        target = free;
      }
      await bb.sdk.files
        .write({ hostId: where.hostId, path: target, content: base64, contentEncoding: "base64" })
        .catch((error: unknown) => { throw describe(error, hostName, target, locale); });
      bb.log.info(`wrote image ${where.hostId}:${target}`);
      return { name: target.slice(dir.length + 1), absPath: target, sizeBytes: Buffer.byteLength(base64, "base64") };
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
