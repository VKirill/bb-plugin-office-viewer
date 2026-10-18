// bb-plugin-office-viewer — server: locate a spreadsheet on the machine that
// owns it and hand its bytes to the viewer.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import * as XLSX from "xlsx";
import WordExtractor from "word-extractor";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { locate, LocateError, within, type Lang, type LocateSdk } from "./src/server/locate.ts";
import { applyCsvEdits, parseCsv, serializeCsv } from "./src/spreadsheet/csv.ts";
import { editMode, extensionOf } from "./src/spreadsheet/sheet.ts";
import { PatchError, patchXlsx, type CellEdit } from "./src/spreadsheet/xlsx-patch.ts";
import { fetchPublic } from "./src/server/web.ts";
import { parseWireframe } from "./src/studio/prototype/model.ts";
import { parsePaintDoc } from "./src/studio/paint/paint-model.ts";
import {
  ensureWireframeAgentSchema,
  hashUtf8,
  prototypeRefPath,
} from "./src/server/wireframe-agent.ts";
import {
  wireframeCodeFilePath,
  wireframeCodeReadmePath,
  wireframeSpecAssetPath,
  wireframeSpecPath,
} from "./src/server/wireframe-export.ts";
import { freeStem, listedStem, pngPath, prototypesDir, sanitizeStem, wireframePath } from "./src/server/wireframes.ts";
import { appendWireframeHistorySnapshot, readHistoryIndex } from "./src/server/wireframe-history-store.ts";
import { historySnapshotPath, wireframeHistoryReasons } from "./src/server/wireframe-history.ts";
import { freePaintStem, listedPaintStem, paintDir, paintJsonPath, paintPngPath, sanitizePaintStem } from "./src/server/paint.ts";
import { parseSlidesDeck } from "./src/studio/slides/model.ts";
import { freeSlidesStem, listedSlidesStem, slidesDir, slidesJsonPath, slidesPngPath, sanitizeSlidesStem } from "./src/server/slides.ts";
import { loadHugeiconsByNames } from "./src/server/hugeicons.ts";

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
  /** A web page for the site device viewer, fetched by the server: framing rules don't apply, internal addresses are refused. */
  webPage: {
    input: z.object({ url: z.string().min(1).max(8192) }).strict(),
    output: z.object({ base64: z.string(), contentType: z.string(), finalUrl: z.string() }).strict(),
  },
  /** A file of that page's site (picture, font, stylesheet) for a screenshot. */
  webFile: {
    input: z.object({ url: z.string().min(1).max(8192) }).strict(),
    output: z.object({ base64: z.string(), contentType: z.string() }).strict(),
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
  /** Writes a wireframe JSON and its PNG under the thread's Prototypes/ folder. */
  saveWireframe: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        name: z.string().min(1).max(255),
        json: z.string().min(2).max(8 * 1024 * 1024),
        pngBase64: z.string().min(1).max(60 * 1024 * 1024).optional(),
        overwrite: z.boolean(),
        locale: z.enum(["en", "ru"]).optional(),
        snapshotReason: z.enum(wireframeHistoryReasons).optional(),
      })
      .strict(),
    output: z.object({ name: z.string(), jsonPath: z.string(), pngPath: z.string() }).strict(),
  },
  listWireframeHistory: {
    input: z.object({ threadId: z.string().min(1).max(256), name: z.string().min(1).max(255), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z
      .object({
        snapshots: z.array(
          z.object({ id: z.string(), createdAt: z.number(), reason: z.enum(wireframeHistoryReasons) }).strict(),
        ),
      })
      .strict(),
  },
  loadWireframeHistory: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        name: z.string().min(1).max(255),
        snapshotId: z.string().min(1).max(128),
        locale: z.enum(["en", "ru"]).optional(),
      })
      .strict(),
    output: z.object({ json: z.string(), readOnly: z.literal(true) }).strict(),
  },
  restoreWireframeHistory: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        name: z.string().min(1).max(255),
        snapshotId: z.string().min(1).max(128),
        locale: z.enum(["en", "ru"]).optional(),
      })
      .strict(),
    output: z.object({ name: z.string(), jsonPath: z.string() }).strict(),
  },
  appendWireframeSnapshot: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        name: z.string().min(1).max(255),
        json: z.string().min(2).max(8 * 1024 * 1024),
        reason: z.enum(wireframeHistoryReasons),
        locale: z.enum(["en", "ru"]).optional(),
      })
      .strict(),
    output: z.object({ snapshotId: z.string() }).strict(),
  },
  listWireframes: {
    input: z.object({ threadId: z.string().min(1).max(256), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z.object({ names: z.array(z.string()) }).strict(),
  },
  loadWireframe: {
    input: z.object({ threadId: z.string().min(1).max(256), name: z.string().min(1).max(255), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z.object({ json: z.string(), absPath: z.string() }).strict(),
  },
  statWireframe: {
    input: z.object({ threadId: z.string().min(1).max(256), name: z.string().min(1).max(255), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z.object({ sha256: z.string(), sizeBytes: z.number().int().nonnegative() }).strict(),
  },
  ensureWireframeAgentSchema: {
    input: z.object({ threadId: z.string().min(1).max(256), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z
      .object({
        schemaMdPath: z.string(),
        schemaJsonPath: z.string(),
        prototypesDir: z.string(),
      })
      .strict(),
  },
  savePrototypeRef: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        fileName: z.string().min(1).max(255),
        base64: z.string().min(1).max(60 * 1024 * 1024),
        contentType: z.string().min(1).max(128).optional(),
        locale: z.enum(["en", "ru"]).optional(),
      })
      .strict(),
    output: z.object({ absPath: z.string() }).strict(),
  },
  readPrototypeAsset: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        relPath: z.string().min(1).max(512),
        locale: z.enum(["en", "ru"]).optional(),
      })
      .strict(),
    output: z.object({ base64: z.string(), contentType: z.string() }).strict(),
  },
  readDesignMd: {
    input: z.object({ threadId: z.string().min(1).max(256), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z.object({ markdown: z.string().nullable() }).strict(),
  },
  writePrototypeDeliverables: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        stem: z.string().min(1).max(255),
        specMarkdown: z.string().min(1).max(8 * 1024 * 1024).optional(),
        specImages: z
          .array(z.object({ relPath: z.string().min(1).max(512), base64: z.string().min(1).max(60 * 1024 * 1024) }).strict())
          .max(50)
          .optional(),
        codeFiles: z
          .array(z.object({ fileName: z.string().min(1).max(255), content: z.string().min(1).max(2 * 1024 * 1024) }).strict())
          .max(50)
          .optional(),
        codeReadme: z.string().min(1).max(512 * 1024).optional(),
        locale: z.enum(["en", "ru"]).optional(),
      })
      .strict(),
    output: z.object({ specPath: z.string().nullable(), paths: z.array(z.string()) }).strict(),
  },
  /** Writes a drawing PNG and its sidecar JSON under the thread's Paint/ folder. */
  savePaint: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        name: z.string().min(1).max(255),
        json: z.string().min(2).max(8 * 1024 * 1024),
        pngBase64: z.string().min(1).max(60 * 1024 * 1024).optional(),
        overwrite: z.boolean(),
        locale: z.enum(["en", "ru"]).optional(),
      })
      .strict(),
    output: z.object({ name: z.string(), jsonPath: z.string(), pngPath: z.string() }).strict(),
  },
  listPaints: {
    input: z.object({ threadId: z.string().min(1).max(256), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z.object({ names: z.array(z.string()) }).strict(),
  },
  loadPaint: {
    input: z.object({ threadId: z.string().min(1).max(256), name: z.string().min(1).max(255), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z.object({ json: z.string(), absPath: z.string() }).strict(),
  },
  saveSlides: {
    input: z
      .object({
        threadId: z.string().min(1).max(256),
        name: z.string().min(1).max(255),
        json: z.string().min(2).max(8 * 1024 * 1024),
        pngBase64: z.string().min(1).max(60 * 1024 * 1024).optional(),
        overwrite: z.boolean(),
        locale: z.enum(["en", "ru"]).optional(),
      })
      .strict(),
    output: z.object({ name: z.string(), jsonPath: z.string(), pngPath: z.string() }).strict(),
  },
  listSlides: {
    input: z.object({ threadId: z.string().min(1).max(256), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z.object({ names: z.array(z.string()) }).strict(),
  },
  loadSlides: {
    input: z.object({ threadId: z.string().min(1).max(256), name: z.string().min(1).max(255), locale: z.enum(["en", "ru"]).optional() }).strict(),
    output: z.object({ json: z.string(), absPath: z.string() }).strict(),
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

  // modern-screenshot for HTML screenshots: the page in its sandbox and the mockups around it draw themselves with it.
  const screenshotVersion = (require("modern-screenshot/package.json") as { version: string }).version;
  let screenshotBody: Promise<Buffer> | null = null;
  bb.http.route("GET", "/capture/modern-screenshot.js", async (context) => {
    if (context.req.header("if-none-match") === `"${screenshotVersion}"`) return new Response(null, { status: 304 });
    screenshotBody ??= readFile(require.resolve("modern-screenshot/dist/index.js"));
    return new Response(new Uint8Array(await screenshotBody), {
      headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", etag: `"${screenshotVersion}"`, "access-control-allow-origin": "*" },
    });
  });

  // Prototype builder: Hugeicons SVG paths by name (batched POST). Keeps @hugeicons/core-free-icons off the app bundle.
  const schemaAssetRoot = join(dirname(fileURLToPath(import.meta.url)), "src/studio/prototype");
  let wireframeSchemaMd: Promise<Buffer> | null = null;
  let wireframeSchemaJson: Promise<Buffer> | null = null;
  bb.http.route("GET", "/prototype/wireframe-schema.md", async (context) => {
    wireframeSchemaMd ??= readFile(join(schemaAssetRoot, "WIREFRAME_SCHEMA.md"));
    const body = await wireframeSchemaMd;
    return new Response(new Uint8Array(body), {
      headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "private, max-age=3600" },
    });
  });
  bb.http.route("GET", "/prototype/wireframe.schema.json", async (context) => {
    wireframeSchemaJson ??= readFile(join(schemaAssetRoot, "wireframe.schema.json"));
    const body = await wireframeSchemaJson;
    return new Response(new Uint8Array(body), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=3600" },
    });
  });

  bb.http.route("POST", "/prototype/hugeicons", async (context) => {
    const body = (await context.req.json().catch(() => null)) as { names?: unknown } | null;
    const raw = Array.isArray(body?.names) ? body.names : [];
    const names = raw.filter((entry): entry is string => typeof entry === "string");
    const icons = await loadHugeiconsByNames(names);
    return new Response(JSON.stringify({ icons }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, max-age=3600",
        "access-control-allow-origin": "*",
      },
    });
  });

  bb.rpc.register(rpcContract, {
    webPage: async ({ url }) => {
      const page = await fetchPublic(url);
      return { base64: Buffer.from(page.bytes).toString("base64"), contentType: page.contentType, finalUrl: page.finalUrl };
    },
    webFile: async ({ url }) => {
      const file = await fetchPublic(url);
      return { base64: Buffer.from(file.bytes).toString("base64"), contentType: file.contentType };
    },
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
    saveWireframe: async ({ threadId, name, json, pngBase64, overwrite, locale = "en", snapshotReason }) => {
      parseWireframe(json);
      const stemWanted = sanitizeStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      let stem = stemWanted;
      if (!overwrite) {
        const probes = [stemWanted, ...Array.from({ length: 98 }, (_, i) => `${stemWanted}-${i + 2}`)].map((candidate) => wireframePath(dir, candidate, locale));
        const { existence } = await bb.sdk.hosts.pathsExist({ hostId: storage.hostId, paths: probes });
        stem = freeStem(dir, stemWanted, existence, locale);
      }
      const jsonAbs = wireframePath(dir, stem, locale);
      const pngAbs = pngPath(dir, stem, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      await bb.sdk.files
        .write({ hostId: storage.hostId, path: jsonAbs, content: json, contentEncoding: "utf8", createParents: true })
        .catch((error: unknown) => { throw describe(error, hostName, jsonAbs, locale); });
      if (pngBase64) {
        await bb.sdk.files
          .write({ hostId: storage.hostId, path: pngAbs, content: pngBase64, contentEncoding: "base64", createParents: true })
          .catch((error: unknown) => { throw describe(error, hostName, pngAbs, locale); });
      }
      if (snapshotReason) {
        await appendWireframeHistorySnapshot(bb.sdk.files, storage.hostId, dir, stem, json, snapshotReason, locale).catch((error: unknown) => {
          bb.log.warn(`wireframe history snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
      await ensureWireframeAgentSchema(
        bb.sdk.files,
        storage.hostId,
        storage.storageRootPath,
        async (paths) => {
          const { existence } = await bb.sdk.hosts.pathsExist({ hostId: storage.hostId, paths });
          return existence;
        },
        locale,
      ).catch((error: unknown) => {
        bb.log.warn(`wireframe agent schema copy failed: ${error instanceof Error ? error.message : String(error)}`);
      });
      bb.log.info(`wrote wireframe ${storage.hostId}:${jsonAbs}`);
      return { name: stem, jsonPath: jsonAbs, pngPath: pngAbs };
    },
    statWireframe: async ({ threadId, name, locale = "en" }) => {
      const stem = sanitizeStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const absPath = wireframePath(prototypesDir(storage.storageRootPath, locale), stem, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      const file = await bb.sdk.files
        .read({ hostId: storage.hostId, path: absPath })
        .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      const json = file.contentEncoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;
      return { sha256: hashUtf8(json), sizeBytes: Buffer.byteLength(json, "utf8") };
    },
    ensureWireframeAgentSchema: async ({ threadId, locale = "en" }) => {
      const storage = await sdk.threads.storageLocation({ threadId });
      return ensureWireframeAgentSchema(
        bb.sdk.files,
        storage.hostId,
        storage.storageRootPath,
        async (paths) => {
          const { existence } = await bb.sdk.hosts.pathsExist({ hostId: storage.hostId, paths });
          return existence;
        },
        locale,
      );
    },
    savePrototypeRef: async ({ threadId, fileName, base64, locale = "en" }) => {
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      const absPath = prototypeRefPath(dir, fileName, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      await bb.sdk.files
        .write({ hostId: storage.hostId, path: absPath, content: base64, contentEncoding: "base64", createParents: true })
        .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
      return { absPath };
    },
    writePrototypeDeliverables: async ({ threadId, stem, specMarkdown, specImages = [], codeFiles = [], codeReadme, locale = "en" }) => {
      const stemSafe = sanitizeStem(stem, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      const written: string[] = [];
      let specPath: string | null = null;
      if (specMarkdown) {
        specPath = wireframeSpecPath(dir, stemSafe, locale);
        await bb.sdk.files
          .write({ hostId: storage.hostId, path: specPath, content: specMarkdown, contentEncoding: "utf8", createParents: true })
          .catch((error: unknown) => { throw describe(error, hostName, specPath!, locale); });
        written.push(specPath);
      }
      for (const image of specImages) {
        const absPath = wireframeSpecAssetPath(dir, image.relPath, locale);
        await bb.sdk.files
          .write({ hostId: storage.hostId, path: absPath, content: image.base64, contentEncoding: "base64", createParents: true })
          .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
        written.push(absPath);
      }
      if (codeReadme) {
        const readmePath = wireframeCodeReadmePath(dir, stemSafe, locale);
        await bb.sdk.files
          .write({ hostId: storage.hostId, path: readmePath, content: codeReadme, contentEncoding: "utf8", createParents: true })
          .catch((error: unknown) => { throw describe(error, hostName, readmePath, locale); });
        written.push(readmePath);
      }
      for (const file of codeFiles) {
        const absPath = wireframeCodeFilePath(dir, stemSafe, file.fileName, locale);
        await bb.sdk.files
          .write({ hostId: storage.hostId, path: absPath, content: file.content, contentEncoding: "utf8", createParents: true })
          .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
        written.push(absPath);
      }
      return { specPath, paths: written };
    },
    readPrototypeAsset: async ({ threadId, relPath, locale = "en" }) => {
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
      const absPath = within(dir, normalized, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      const file = await bb.sdk.files
        .read({ hostId: storage.hostId, path: absPath })
        .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      const lower = normalized.toLowerCase();
      const contentType = lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
          ? "image/jpeg"
          : lower.endsWith(".webp")
            ? "image/webp"
            : lower.endsWith(".gif")
              ? "image/gif"
              : "application/octet-stream";
      const base64 = file.contentEncoding === "base64" ? file.content : Buffer.from(file.content, "utf8").toString("base64");
      return { base64, contentType };
    },
    readDesignMd: async ({ threadId, locale = "en" }) => {
      try {
        const where = await locate(sdk, { kind: "workspace", threadId, environmentId: null, projectId: null }, "DESIGN.md", locale);
        const file = await bb.sdk.files.read({ hostId: where.hostId, path: where.absPath });
        if (!("content" in file)) return { markdown: null };
        const markdown = file.contentEncoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;
        return { markdown };
      } catch {
        return { markdown: null };
      }
    },
    listWireframeHistory: async ({ threadId, name, locale = "en" }) => {
      const stem = sanitizeStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      const index = await readHistoryIndex(bb.sdk.files, storage.hostId, dir, stem, locale);
      return { snapshots: index.entries };
    },
    loadWireframeHistory: async ({ threadId, name, snapshotId, locale = "en" }) => {
      const stem = sanitizeStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      const absPath = historySnapshotPath(dir, stem, snapshotId, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      const file = await bb.sdk.files
        .read({ hostId: storage.hostId, path: absPath })
        .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      const json = file.contentEncoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;
      parseWireframe(json);
      return { json, readOnly: true as const };
    },
    restoreWireframeHistory: async ({ threadId, name, snapshotId, locale = "en" }) => {
      const stem = sanitizeStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      const snapPath = historySnapshotPath(dir, stem, snapshotId, locale);
      const jsonAbs = wireframePath(dir, stem, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      const file = await bb.sdk.files
        .read({ hostId: storage.hostId, path: snapPath })
        .catch((error: unknown) => { throw describe(error, hostName, snapPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      const json = file.contentEncoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;
      parseWireframe(json);
      await bb.sdk.files
        .write({ hostId: storage.hostId, path: jsonAbs, content: json, contentEncoding: "utf8", createParents: true })
        .catch((error: unknown) => { throw describe(error, hostName, jsonAbs, locale); });
      await appendWireframeHistorySnapshot(bb.sdk.files, storage.hostId, dir, stem, json, "save", locale).catch(() => {});
      return { name: stem, jsonPath: jsonAbs };
    },
    appendWireframeSnapshot: async ({ threadId, name, json, reason, locale = "en" }) => {
      parseWireframe(json);
      const stem = sanitizeStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      const snapshotId = await appendWireframeHistorySnapshot(bb.sdk.files, storage.hostId, dir, stem, json, reason, locale);
      return { snapshotId };
    },
    listWireframes: async ({ threadId, locale = "en" }) => {
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = prototypesDir(storage.storageRootPath, locale);
      const listed = await bb.sdk.files.list({ hostId: storage.hostId, path: dir, limit: 5000, includeHidden: false }).catch(() => ({ files: [] as { name?: string; path: string }[] }));
      const names = listed.files
        .map((file) => listedStem(file.name ?? file.path))
        .filter((stem): stem is string => stem !== null);
      names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      return { names };
    },
    loadWireframe: async ({ threadId, name, locale = "en" }) => {
      const stem = sanitizeStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const absPath = wireframePath(prototypesDir(storage.storageRootPath, locale), stem, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      const file = await bb.sdk.files
        .read({ hostId: storage.hostId, path: absPath })
        .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      const json = file.contentEncoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;
      parseWireframe(json);
      return { json, absPath };
    },
    savePaint: async ({ threadId, name, json, pngBase64, overwrite, locale = "en" }) => {
      parsePaintDoc(json);
      const stemWanted = sanitizePaintStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = paintDir(storage.storageRootPath, locale);
      let stem = stemWanted;
      if (!overwrite) {
        const probes = [stemWanted, ...Array.from({ length: 98 }, (_, i) => `${stemWanted}-${i + 2}`)].map((candidate) => paintJsonPath(dir, candidate, locale));
        const { existence } = await bb.sdk.hosts.pathsExist({ hostId: storage.hostId, paths: probes });
        stem = freePaintStem(dir, stemWanted, existence, locale);
      }
      const jsonAbs = paintJsonPath(dir, stem, locale);
      const pngAbs = paintPngPath(dir, stem, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      await bb.sdk.files
        .write({ hostId: storage.hostId, path: jsonAbs, content: json, contentEncoding: "utf8", createParents: true })
        .catch((error: unknown) => { throw describe(error, hostName, jsonAbs, locale); });
      if (pngBase64) {
        await bb.sdk.files
          .write({ hostId: storage.hostId, path: pngAbs, content: pngBase64, contentEncoding: "base64", createParents: true })
          .catch((error: unknown) => { throw describe(error, hostName, pngAbs, locale); });
      }
      bb.log.info(`wrote paint ${storage.hostId}:${jsonAbs}`);
      return { name: stem, jsonPath: jsonAbs, pngPath: pngAbs };
    },
    listPaints: async ({ threadId, locale = "en" }) => {
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = paintDir(storage.storageRootPath, locale);
      const listed = await bb.sdk.files.list({ hostId: storage.hostId, path: dir, limit: 5000, includeHidden: false }).catch(() => ({ files: [] as { name?: string; path: string }[] }));
      const names = listed.files
        .map((file) => listedPaintStem(file.name ?? file.path))
        .filter((stem): stem is string => stem !== null);
      names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      return { names };
    },
    loadPaint: async ({ threadId, name, locale = "en" }) => {
      const stem = sanitizePaintStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const absPath = paintJsonPath(paintDir(storage.storageRootPath, locale), stem, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      const file = await bb.sdk.files
        .read({ hostId: storage.hostId, path: absPath })
        .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      const json = file.contentEncoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;
      parsePaintDoc(json);
      return { json, absPath };
    },
    saveSlides: async ({ threadId, name, json, pngBase64, overwrite, locale = "en" }) => {
      parseSlidesDeck(json);
      const stemWanted = sanitizeSlidesStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = slidesDir(storage.storageRootPath, locale);
      let stem = stemWanted;
      if (!overwrite) {
        const probes = [stemWanted, ...Array.from({ length: 98 }, (_, i) => `${stemWanted}-${i + 2}`)].map((candidate) => slidesJsonPath(dir, candidate, locale));
        const { existence } = await bb.sdk.hosts.pathsExist({ hostId: storage.hostId, paths: probes });
        stem = freeSlidesStem(dir, stemWanted, existence, locale);
      }
      const jsonAbs = slidesJsonPath(dir, stem, locale);
      const pngAbs = slidesPngPath(dir, stem, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      await bb.sdk.files
        .write({ hostId: storage.hostId, path: jsonAbs, content: json, contentEncoding: "utf8", createParents: true })
        .catch((error: unknown) => { throw describe(error, hostName, jsonAbs, locale); });
      if (pngBase64) {
        await bb.sdk.files
          .write({ hostId: storage.hostId, path: pngAbs, content: pngBase64, contentEncoding: "base64", createParents: true })
          .catch((error: unknown) => { throw describe(error, hostName, pngAbs, locale); });
      }
      bb.log.info(`wrote slides ${storage.hostId}:${jsonAbs}`);
      return { name: stem, jsonPath: jsonAbs, pngPath: pngAbs };
    },
    listSlides: async ({ threadId, locale = "en" }) => {
      const storage = await sdk.threads.storageLocation({ threadId });
      const dir = slidesDir(storage.storageRootPath, locale);
      const listed = await bb.sdk.files.list({ hostId: storage.hostId, path: dir, limit: 5000, includeHidden: false }).catch(() => ({ files: [] as { name?: string; path: string }[] }));
      const names = listed.files
        .map((file) => listedSlidesStem(file.name ?? file.path))
        .filter((stem): stem is string => stem !== null);
      names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      return { names };
    },
    loadSlides: async ({ threadId, name, locale = "en" }) => {
      const stem = sanitizeSlidesStem(name, locale);
      const storage = await sdk.threads.storageLocation({ threadId });
      const absPath = slidesJsonPath(slidesDir(storage.storageRootPath, locale), stem, locale);
      const hostName = (await bb.sdk.hosts.get({ hostId: storage.hostId }).catch(() => null))?.name || storage.hostId;
      const file = await bb.sdk.files
        .read({ hostId: storage.hostId, path: absPath })
        .catch((error: unknown) => { throw describe(error, hostName, absPath, locale); });
      if (!("content" in file)) throw new Error(say(locale, "The server returned no file content.", "Сервер не вернул содержимое файла."));
      const json = file.contentEncoding === "base64" ? Buffer.from(file.content, "base64").toString("utf8") : file.content;
      parseSlidesDeck(json);
      return { json, absPath };
    },
  });
}
