// Office Viewer — pages from the web for the site device viewer. The plugin
// server fetches them, so sites that refuse to be framed still show, and the
// page's own files reach the screenshot. The server sits next to BB's other
// services, so it never fetches loopback, private, link-local or otherwise
// non-public addresses.
//
// Each hop resolves the host once, refuses it if any of its addresses is not
// public, then connects to that one checked address (Host header and TLS SNI
// still carry the name). A second DNS answer can't swap in another address
// between the check and the connection (DNS rebinding). Redirects are followed
// by hand and every hop is checked again.
import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { pipeline, type Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

export const MAX_WEB_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export class WebError extends Error {}

// ---------------------------------------------------------------------------
// Address classification
// ---------------------------------------------------------------------------

/** IPv4 ranges that are not the public internet (IANA special-purpose registry plus multicast and reserved). */
const IPV4_BLOCKED: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], // "this network", includes 0.0.0.0
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT, Tailscale
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast (deprecated)
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, includes 255.255.255.255
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

const IPV4_BLOCKED_INT = IPV4_BLOCKED.map(([base, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return [(ipv4ToInt(base) & mask) >>> 0, mask] as const;
});

function isInternalV4Int(value: number): boolean {
  return IPV4_BLOCKED_INT.some(([base, mask]) => ((value & mask) >>> 0) === base);
}

/** Eight 16-bit groups of a valid IPv6 address (zone id dropped, embedded dotted IPv4 tail accepted). */
function ipv6Groups(ip: string): number[] {
  let text = ip.split("%")[0]!;
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const v4 = ipv4ToInt(dotted[1]!);
    text = text.slice(0, -dotted[1]!.length) + `${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const [head, tail] = text.includes("::") ? text.split("::") as [string, string] : [text, undefined];
  const left = head ? head.split(":") : [];
  const right = tail === undefined ? [] : tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : new Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...fill, ...right].map((group) => parseInt(group, 16));
}

function isInternalV6(ip: string): boolean {
  const g = ipv6Groups(ip);
  const v4At = (hi: number, lo: number) => ((g[hi]! << 16) | g[lo]!) >>> 0;
  const zeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (IPv4-compatible): judge the IPv4 address inside.
  if (zeroUpTo(5) && g[5] === 0xffff) return isInternalV4Int(v4At(6, 7));
  // NAT64 well-known prefix 64:ff9b::/96: judge the IPv4 address inside (public sites stay reachable on DNS64 networks).
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) return isInternalV4Int(v4At(6, 7));
  // 6to4 2002::/16: the IPv4 address sits in groups 1-2.
  if (g[0] === 0x2002) return isInternalV4Int(v4At(1, 2));
  // Only global unicast 2000::/3 is public. Outside it: ::, ::1, ::/96, 64:ff9b:1::/48, fc00::/7 (ULA),
  // fe80::/10 (link-local), fec0::/10 (site-local), ff00::/8 (multicast) and the rest of the reserved space.
  if ((g[0]! & 0xe000) !== 0x2000) return true;
  if (g[0] === 0x2001 && g[1]! < 0x0200) return true; // 2001::/23 IETF protocol assignments (Teredo, benchmarking, ORCHID)
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x3fff && g[1]! < 0x1000) return true; // 3fff::/20 documentation
  if (g[0] === 0x5f00) return true; // SRv6 SIDs
  return false;
}

/** True for any address that is not on the public internet: loopback, private, link-local, CGNAT, multicast, reserved. Not an IP at all counts as internal. */
export function isInternalAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  const family = isIP(ip.split("%")[0]!);
  if (family === 4) return isInternalV4Int(ipv4ToInt(ip));
  if (family === 6) return isInternalV6(ip);
  return true;
}

// ---------------------------------------------------------------------------
// URL checks
// ---------------------------------------------------------------------------

/** Ports browsers refuse to fetch (WHATWG Fetch "bad port"); Node's fetch refused them too. */
const BAD_PORTS = new Set([
  0, 1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135,
  137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720,
  1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);

export type Resolver = (hostname: string) => Promise<string[]>;

/** All addresses of a name, as the system resolver returns them. */
export const systemResolver: Resolver = async (hostname) => (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

/** A checked hop: the URL and the one public address to connect to. */
export type PublicTarget = { url: URL; address: string };

/**
 * The URL if it is http(s) on an allowed port and its host resolves only to public addresses, with the address to use.
 * WHATWG URL parsing already turns decimal, octal, hex and short IPv4 forms (2130706433, 0x7f.1, 127.1) into dotted
 * quads and compresses IPv6, so the classifier sees canonical text.
 */
export async function publicTarget(raw: string, resolve: Resolver = systemResolver): Promise<PublicTarget> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebError(`Not a web address: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new WebError(`Only http and https pages open here: ${raw}`);
  if (url.port && BAD_PORTS.has(Number(url.port))) throw new WebError(`Port ${url.port} doesn't open here: ${raw}`);
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "").toLowerCase();
  if (!host) throw new WebError(`Host not found: ${url.hostname}`);
  if (host === "localhost" || host.endsWith(".localhost")) throw new WebError(`Internal addresses don't open here: ${url.hostname}`);
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => [] as string[]);
  if (!addresses.length) throw new WebError(`Host not found: ${url.hostname}`);
  if (addresses.some(isInternalAddress)) throw new WebError(`Internal addresses don't open here: ${url.hostname}`);
  return { url, address: addresses[0]! };
}

/** The URL if it is http(s) and its host resolves only to public addresses. */
export async function publicUrl(raw: string, resolve: Resolver = systemResolver): Promise<URL> {
  return (await publicTarget(raw, resolve)).url;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export type HopResponse = { status: number; headers: IncomingHttpHeaders; body: Readable };

/** One GET of `target.url`, connected to `target.address` only. Host header and SNI keep the URL's name. */
export type Transport = (target: PublicTarget, signal: AbortSignal) => Promise<HopResponse>;

const REQUEST_HEADERS = {
  "user-agent": USER_AGENT,
  accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "accept-language": "ru,en;q=0.8",
  "accept-encoding": "gzip, deflate, br",
};

export const pinnedTransport: Transport = ({ url, address }, signal) =>
  new Promise<HopResponse>((resolvePromise, reject) => {
    const https = url.protocol === "https:";
    const name = url.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "");
    const options = {
      method: "GET",
      host: address, // an IP literal: Node connects to it directly, no DNS lookup happens here
      port: url.port ? Number(url.port) : https ? 443 : 80,
      path: `${url.pathname}${url.search}`,
      headers: { ...REQUEST_HEADERS, host: url.host },
      signal,
      ...(https && !isIP(name) ? { servername: name } : {}),
    };
    // The certificate is checked against `servername` (the URL's name), or the IP itself for IP URLs.
    const req = https ? httpsRequest(options, onResponse) : httpRequest(options, onResponse);
    function onResponse(res: IncomingMessage) {
      resolvePromise({ status: res.statusCode ?? 0, headers: res.headers, body: res });
    }
    req.on("error", reject);
    req.end();
  });

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function decoded(body: Readable, encoding: string | undefined): Readable {
  const name = (encoding ?? "").trim().toLowerCase();
  const decoder = name === "gzip" || name === "x-gzip" ? createGunzip() : name === "deflate" ? createInflate() : name === "br" ? createBrotliDecompress() : null;
  // pipeline, not pipe: an aborted or broken body also ends the decoder, so the read below can't hang.
  return decoder ? pipeline(body, decoder, () => {}) : body;
}

async function readCapped(body: Readable, limit: number, href: string): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += buffer.byteLength;
    if (total > limit) {
      body.destroy();
      throw new WebError(`Larger than ${limit / 1024 / 1024} MB: ${href}`);
    }
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks, total));
}

export type FetchOptions = { resolve?: Resolver; transport?: Transport; timeoutMs?: number; maxBytes?: number };

/** GET a public URL, following redirects only to public URLs; at most MAX_WEB_BYTES. */
export async function fetchPublic(raw: string, options: FetchOptions = {}): Promise<{ bytes: Uint8Array; contentType: string; finalUrl: string }> {
  const { resolve = systemResolver, transport = pinnedTransport, timeoutMs = TIMEOUT_MS, maxBytes = MAX_WEB_BYTES } = options;
  let target = await publicTarget(raw, resolve);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await transport(target, controller.signal);
      const location = headerValue(response.headers, "location");
      if (response.status >= 300 && response.status < 400 && location) {
        response.body.destroy();
        target = await publicTarget(new URL(location, target.url).href, resolve);
        continue;
      }
      if (response.status < 200 || response.status > 299) {
        response.body.destroy();
        throw new WebError(`HTTP ${response.status}: ${target.url.href}`);
      }
      const declared = Number(headerValue(response.headers, "content-length") ?? 0);
      if (declared > maxBytes) {
        response.body.destroy();
        throw new WebError(`Larger than ${maxBytes / 1024 / 1024} MB: ${target.url.href}`);
      }
      const bytes = await readCapped(decoded(response.body, headerValue(response.headers, "content-encoding")), maxBytes, target.url.href);
      return { bytes, contentType: headerValue(response.headers, "content-type") ?? "", finalUrl: target.url.href };
    } catch (error) {
      if (controller.signal.aborted) throw new WebError(`Timed out: ${target.url.href}`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new WebError(`Too many redirects: ${raw}`);
}
