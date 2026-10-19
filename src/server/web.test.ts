import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as createHttpsServer, globalAgent } from "node:https";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { test } from "node:test";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { WebError, fetchPublic, isInternalAddress, pinnedTransport, publicTarget, publicUrl, type HopResponse, type PublicTarget, type Resolver } from "./web.ts";

/** A resolver from a fixed table; anything else is "not found". No real DNS. */
const fakeDns = (table: Record<string, string[]>): Resolver & { calls: string[] } => {
  const calls: string[] = [];
  const resolve = async (hostname: string) => {
    calls.push(hostname);
    const hit = table[hostname];
    if (!hit) throw new Error("ENOTFOUND");
    return hit;
  };
  return Object.assign(resolve, { calls });
};

const noDns: Resolver = async () => {
  throw new Error("DNS must not be used here");
};

const respond = (status: number, headers: Record<string, string> = {}, body: Buffer | string = ""): HopResponse => ({
  status,
  headers,
  body: Readable.from([Buffer.from(body)]),
});

test("internal addresses: loopback, private, link-local, CGNAT, reserved and their IPv6 forms", () => {
  const internal = [
    "127.0.0.1", "127.255.255.254", "10.8.0.1", "172.16.5.4", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "100.100.100.100",
    "100.127.255.255", "0.0.0.0", "0.1.2.3", "198.18.0.1", "198.19.255.255", "192.0.0.8", "192.0.2.1", "198.51.100.7", "203.0.113.9", "224.0.0.251",
    "239.255.255.250", "240.0.0.1", "255.255.255.255",
    "::1", "::", "[::1]", "fd12::1", "fc00::1", "fe80::1", "fe80::1%en0", "febf::1", "fec0::1", "ff02::1", "ff05::2",
    "::ffff:10.0.0.1", "::ffff:127.0.0.1", "::ffff:7f00:1", "[::ffff:7f00:1]", "::ffff:a9fe:a9fe", "::ffff:6440:1", "::127.0.0.1", "::7f00:1",
    "64:ff9b::7f00:1", "64:ff9b::10.0.0.1", "64:ff9b::a9fe:a9fe", "64:ff9b:1::1", "2002:7f00:1::1", "2002:c0a8:101::1",
    "2001::1", "2001:db8::1", "3fff::1", "100::1", "5f00::1",
    "not-an-ip", "",
  ];
  for (const address of internal) assert.equal(isInternalAddress(address), true, address);
  const external = ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "100.63.255.255", "51.170.50.52", "198.20.0.1", "2a00:1450:4010::64", "2606:4700::1111", "::ffff:8.8.8.8", "::ffff:808:808", "64:ff9b::808:808", "2002:808:808::1"];
  for (const address of external) assert.equal(isInternalAddress(address), false, address);
});

test("only http(s) on allowed ports passes", async () => {
  await assert.rejects(publicUrl("file:///etc/passwd", noDns), /Only http and https/);
  await assert.rejects(publicUrl("ftp://8.8.8.8/", noDns), /Only http and https/);
  await assert.rejects(publicUrl("gopher://8.8.8.8:70/", noDns), /Only http and https/);
  await assert.rejects(publicUrl("data:text/html,hi", noDns), /Only http and https/);
  await assert.rejects(publicUrl("not a url", noDns), /Not a web address/);
  await assert.rejects(publicUrl("http://8.8.8.8:25/", noDns), /Port 25/);
  await assert.rejects(publicUrl("http://8.8.8.8:6667/", noDns), /Port 6667/);
  assert.equal((await publicUrl("https://8.8.8.8/x", noDns)).href, "https://8.8.8.8/x");
  assert.equal((await publicUrl("http://8.8.8.8:8080/x", noDns)).href, "http://8.8.8.8:8080/x");
});

test("IP literal bypass forms are refused without touching DNS", async () => {
  const forms = [
    "http://127.0.0.1:38886/api", "http://127.0.0.1./", "http://127.1/", "http://2130706433/", "http://0x7f.1/", "http://0x7f000001/", "http://017700000001/",
    "http://0177.0.0.1/", "http://[::1]/", "http://[::]/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]:38886/", "http://[0:0:0:0:0:ffff:127.0.0.1]/",
    "http://[::ffff:169.254.169.254]/", "http://[64:ff9b::127.0.0.1]/", "http://[fd00::1]/", "http://[fe80::1]/", "http://[ff02::1]/", "http://0.0.0.0/",
    "http://0/", "http://169.254.169.254/latest/meta-data/", "http://100.64.0.1/", "http://100.101.102.103/", "http://10.0.0.1/", "http://172.16.0.1/",
    "http://192.168.0.1/", "http://198.18.0.1/", "http://224.0.0.1/", "https://[2002:7f00:1::]/",
  ];
  for (const raw of forms) await assert.rejects(publicUrl(raw, noDns), /Internal addresses/, raw);
});

test("localhost names are refused, with or without a trailing dot", async () => {
  for (const raw of ["http://localhost/", "http://localhost./", "http://LOCALHOST:38886/", "http://foo.localhost/", "http://a.b.localhost./"]) {
    await assert.rejects(publicUrl(raw, noDns), /Internal addresses/, raw);
  }
});

test("a name is refused if any of its addresses is internal", async () => {
  const dns = fakeDns({
    "rebind.example": ["127.0.0.1"],
    "mixed.example": ["93.184.216.34", "10.0.0.5"],
    "v6loop.example": ["::ffff:7f00:1"],
    "tailnet.example": ["100.64.1.2"],
    "meta.example": ["169.254.169.254"],
    "ula.example": ["2a00:1450::1", "fd00::5"],
  });
  for (const host of ["rebind.example", "mixed.example", "v6loop.example", "tailnet.example", "meta.example", "ula.example", "rebind.example."]) {
    await assert.rejects(publicUrl(`http://${host}/`, dns), /Internal addresses/, host);
  }
  await assert.rejects(publicUrl("http://nowhere.example/", dns), /Host not found/);
});

test("a public name passes and the checked address is the one to connect to", async () => {
  const dns = fakeDns({ "example.com": ["93.184.216.34", "2606:2800:220:1::248"] });
  const target = await publicTarget("https://example.com/page?q=1", dns);
  assert.equal(target.url.href, "https://example.com/page?q=1");
  assert.equal(target.address, "93.184.216.34");
  assert.deepEqual(dns.calls, ["example.com"]);
});

test("fetchPublic resolves once per hop and hands the checked address to the transport", async () => {
  const dns = fakeDns({ "example.com": ["93.184.216.34"] });
  const seen: PublicTarget[] = [];
  const page = await fetchPublic("https://example.com/", {
    resolve: dns,
    transport: async (target) => {
      seen.push(target);
      return respond(200, { "content-type": "text/html; charset=utf-8" }, "<h1>hi</h1>");
    },
  });
  assert.equal(new TextDecoder().decode(page.bytes), "<h1>hi</h1>");
  assert.equal(page.contentType, "text/html; charset=utf-8");
  assert.equal(page.finalUrl, "https://example.com/");
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.address, "93.184.216.34");
  assert.deepEqual(dns.calls, ["example.com"]);
});

test("redirects are re-checked: a hop to a private, loopback or CGNAT address is refused", async () => {
  const dns = fakeDns({ "example.com": ["93.184.216.34"], "inner.example": ["192.168.1.1"] });
  for (const location of ["http://127.0.0.1:38886/api", "http://[::ffff:7f00:1]/", "http://100.64.0.7/", "http://inner.example/", "http://localhost/", "file:///etc/passwd", "http://169.254.169.254/"]) {
    let calls = 0;
    await assert.rejects(
      fetchPublic("https://example.com/", {
        resolve: dns,
        transport: async () => {
          calls++;
          return respond(302, { location });
        },
      }),
      /Internal addresses|Only http and https/,
      location,
    );
    assert.equal(calls, 1, location);
  }
});

test("public redirects are followed (relative too), at most five", async () => {
  const dns = fakeDns({ "example.com": ["93.184.216.34"], "www.example.com": ["93.184.216.35"] });
  const hops: string[] = [];
  const page = await fetchPublic("http://example.com/a", {
    resolve: dns,
    transport: async (target) => {
      hops.push(`${target.url.href}@${target.address}`);
      if (target.url.pathname === "/a") return respond(301, { location: "https://www.example.com/b" });
      if (target.url.pathname === "/b") return respond(302, { location: "/c" });
      return respond(200, { "content-type": "text/plain" }, "done");
    },
  });
  assert.equal(page.finalUrl, "https://www.example.com/c");
  assert.deepEqual(hops, ["http://example.com/a@93.184.216.34", "https://www.example.com/b@93.184.216.35", "https://www.example.com/c@93.184.216.35"]);
  await assert.rejects(fetchPublic("http://example.com/", { resolve: dns, transport: async () => respond(302, { location: "/again" }) }), /Too many redirects/);
});

test("errors, size cap, gzip and timeout", async () => {
  const dns = fakeDns({ "example.com": ["93.184.216.34"] });
  await assert.rejects(fetchPublic("http://example.com/", { resolve: dns, transport: async () => respond(404) }), /HTTP 404/);
  await assert.rejects(fetchPublic("http://example.com/", { resolve: dns, maxBytes: 10, transport: async () => respond(200, { "content-length": "11" }, "x".repeat(11)) }), /Larger than/);
  await assert.rejects(fetchPublic("http://example.com/", { resolve: dns, maxBytes: 10, transport: async () => respond(200, {}, "x".repeat(11)) }), /Larger than/);
  // A small gzip body that inflates past the cap is stopped too.
  await assert.rejects(fetchPublic("http://example.com/", { resolve: dns, maxBytes: 1000, transport: async () => respond(200, { "content-encoding": "gzip" }, gzipSync("x".repeat(5000))) }), /Larger than/);
  const zipped = await fetchPublic("http://example.com/", { resolve: dns, transport: async () => respond(200, { "content-encoding": "gzip" }, gzipSync("hello")) });
  assert.equal(new TextDecoder().decode(zipped.bytes), "hello");
  await assert.rejects(
    fetchPublic("http://example.com/", {
      resolve: dns,
      timeoutMs: 20,
      transport: (_target, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
    }),
    /Timed out/,
  );
});

test("pinnedTransport connects to the checked address and keeps the name in Host", async () => {
  // A local server stands in for the "public" address; the name never goes to DNS.
  const server = createServer((req, res) => {
    res.setHeader("content-type", "text/plain");
    res.end(`${req.headers.host} ${req.url} ${req.headers["user-agent"]?.slice(0, 11)}`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const url = new URL(`http://no-such-host.invalid:${port}/path?x=1`);
    const response = await pinnedTransport({ url, address: "127.0.0.1" }, AbortSignal.timeout(5000));
    let text = "";
    for await (const chunk of response.body) text += chunk;
    assert.equal(response.status, 200);
    assert.equal(text, `no-such-host.invalid:${port} /path?x=1 Mozilla/5.0`);
  } finally {
    server.close();
  }
});

test("connection failures try only other addresses from the checked DNS answer", async () => {
  const seen: string[] = [];
  const dns = fakeDns({ "example.com": ["2606:4700::1111", "1.1.1.1"] });
  const page = await fetchPublic("https://example.com/", {
    resolve: dns,
    transport: async ({ address }) => {
      seen.push(address);
      if (address.includes(":")) throw new Error("ENETUNREACH");
      return respond(200, {}, "ok");
    },
  });
  assert.equal(new TextDecoder().decode(page.bytes), "ok");
  assert.deepEqual(seen, ["2606:4700::1111", "1.1.1.1"]);
  assert.deepEqual(dns.calls, ["example.com"]);
});

test("the deadline includes initial DNS and prevents a late connection", async () => {
  let connected = false;
  await assert.rejects(fetchPublic("https://example.com/", {
    timeoutMs: 20,
    resolve: async () => { await new Promise((resolve) => setTimeout(resolve, 70)); return ["1.1.1.1"]; },
    transport: async () => { connected = true; return respond(200); },
  }), /Timed out/);
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal(connected, false);
});

test("the same deadline covers redirect DNS", async () => {
  let calls = 0;
  await assert.rejects(fetchPublic("https://example.com/", {
    timeoutMs: 20,
    resolve: async (name) => {
      if (name === "slow.example") await new Promise((resolve) => setTimeout(resolve, 70));
      return ["1.1.1.1"];
    },
    transport: async () => { calls++; return calls === 1 ? respond(302, { location: "https://slow.example/" }) : respond(200); },
  }), /Timed out/);
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal(calls, 1);
});

test("one deadline spans the whole redirect chain", async () => {
  let calls = 0;
  await assert.rejects(fetchPublic("http://example.com/", {
    timeoutMs: 40,
    resolve: fakeDns({ "example.com": ["1.1.1.1"] }),
    transport: async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return calls === 1 ? respond(302, { location: "/next" }) : respond(200);
    },
  }), /Timed out/);
});

test("exactly five redirects are allowed, but no sixth destination is resolved", async () => {
  for (const redirects of [5, 6]) {
    let calls = 0;
    const dns = fakeDns({ "example.com": ["1.1.1.1"] });
    const result = fetchPublic("http://example.com/", {
      resolve: dns,
      transport: async () => ++calls <= redirects ? respond(302, { location: `/${calls}` }) : respond(200),
    });
    if (redirects === 5) await result;
    else await assert.rejects(result, /Too many redirects/);
    assert.equal(calls, 6);
    assert.equal(dns.calls.length, 6);
  }
});

test("HTTP errors do not retry another address", async () => {
  let calls = 0;
  await assert.rejects(fetchPublic("http://example.com/", {
    resolve: fakeDns({ "example.com": ["1.1.1.1", "8.8.8.8"] }),
    transport: async () => { calls++; return respond(403); },
  }), /HTTP 403/);
  assert.equal(calls, 1);
});

test("deflate and brotli are decoded and capped; corrupt and interrupted bodies fail", async () => {
  const resolve = fakeDns({ "example.com": ["1.1.1.1"] });
  for (const [encoding, compress] of [["deflate", deflateSync], ["br", brotliCompressSync]] as const) {
    const page = await fetchPublic("http://example.com/", { resolve, transport: async () => respond(200, { "content-encoding": encoding }, compress("hello")) });
    assert.equal(new TextDecoder().decode(page.bytes), "hello");
    await assert.rejects(fetchPublic("http://example.com/", { resolve, maxBytes: 100, transport: async () => respond(200, { "content-encoding": encoding }, compress("x".repeat(1000))) }), /Larger than/);
  }
  await assert.rejects(fetchPublic("http://example.com/", { resolve, transport: async () => respond(200, { "content-encoding": "gzip" }, "invalid gzip") }));
  await assert.rejects(fetchPublic("http://example.com/", { resolve, transport: async () => ({ status: 200, headers: {}, body: Readable.from((async function* () { yield "first"; throw new Error("body interrupted"); })()) }) }), /body interrupted/);
});

test("web errors have matching EN/RU messages without changing the English default", () => {
  const error = new WebError("internal", "localhost");
  assert.match(error.message, /Internal addresses/);
  assert.match(error.localized("en").message, /Internal addresses/);
  assert.equal(error.localized("ru").message, "Загрузка внутренних адресов запрещена: localhost");
  assert.equal(new WebError("timeout", "https://example.com/").localized("ru").message, "Время ожидания истекло: https://example.com/");
  assert.equal(new WebError("port", "25").localized("ru").message, "Порт 25 недоступен для загрузки");
});

test("HTTPS pinning preserves Host and SNI, verifies hostname and rejects untrusted certificates", async () => {
  // Public test credentials only: this key and self-signed certificate have no production use.
  const cert = readFileSync(new URL("./fixtures/web-test-cert.pem", import.meta.url));
  const key = readFileSync(new URL("./fixtures/web-test-key.pem", import.meta.url));
  const server = createHttpsServer({ key, cert }, (req, res) => {
    res.end(`${req.headers.host} ${(req.socket as import("node:tls").TLSSocket).servername} ${req.url}`);
  });
  const previousCa = globalAgent.options.ca;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const target = { url: new URL(`https://public.example:${port}/path?q=1`), address: "127.0.0.1" };
    await assert.rejects(pinnedTransport(target, AbortSignal.timeout(5000)), /self-signed|certificate/i);
    globalAgent.options.ca = cert;
    const response = await pinnedTransport(target, AbortSignal.timeout(5000));
    let text = "";
    for await (const chunk of response.body) text += chunk;
    assert.equal(text, `public.example:${port} public.example /path?q=1`);
    await assert.rejects(pinnedTransport({ ...target, url: new URL(`https://wrong.example:${port}/`) }, AbortSignal.timeout(5000)), /hostname|altnames/i);
    const ipResponse = await pinnedTransport({ ...target, url: new URL(`https://127.0.0.1:${port}/`) }, AbortSignal.timeout(5000));
    for await (const _chunk of ipResponse.body) { /* drain the response */ }
    assert.equal(ipResponse.status, 200);
  } finally {
    globalAgent.options.ca = previousCa;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
