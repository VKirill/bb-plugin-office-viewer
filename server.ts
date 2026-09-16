// bb-plugin-office-viewer — server: locate a spreadsheet on the machine that
// owns it and hand its bytes to the viewer.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { locate, LocateError, type Lang, type LocateSdk } from "./locate.ts";

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
});

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

  bb.rpc.register(rpcContract, {
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
  });
}
