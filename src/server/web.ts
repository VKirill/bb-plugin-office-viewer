// Office Viewer — pages from the web for the site device viewer. The plugin
// server fetches them, so sites that refuse to be framed still show, and the
// page's own files reach the screenshot. The server sits next to BB's other
// services, so it never fetches loopback, private or link-local addresses.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MAX_WEB_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export class WebError extends Error {}

/** True for addresses on this machine or its networks: loopback, private, link-local, CGNAT, unspecified. */
export function isInternalAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168);
  }
  if (isIP(ip) === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapped) return isInternalAddress(mapped[1]!);
    return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip);
  }
  return true;
}

/** The URL if it is http(s) and its host resolves only to public addresses. */
export async function publicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebError(`Not a web address: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new WebError(`Only http and https pages open here: ${raw}`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((entry) => entry.address);
  if (!addresses.length) throw new WebError(`Host not found: ${url.hostname}`);
  if (addresses.some(isInternalAddress)) throw new WebError(`Internal addresses don't open here: ${url.hostname}`);
  return url;
}

/** GET a public URL, following redirects only to public URLs; at most MAX_WEB_BYTES. */
export async function fetchPublic(raw: string): Promise<{ bytes: Uint8Array; contentType: string; finalUrl: string }> {
  let url = await publicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "ru,en;q=0.8" },
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = await publicUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new WebError(`HTTP ${response.status}: ${url.href}`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_WEB_BYTES) throw new WebError(`Larger than ${MAX_WEB_BYTES / 1024 / 1024} MB: ${url.href}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_WEB_BYTES) throw new WebError(`Larger than ${MAX_WEB_BYTES / 1024 / 1024} MB: ${url.href}`);
    return { bytes, contentType: response.headers.get("content-type") ?? "", finalUrl: url.href };
  }
  throw new WebError(`Too many redirects: ${raw}`);
}
