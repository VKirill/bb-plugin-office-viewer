import assert from "node:assert/strict";
import { test } from "node:test";
import { isInternalAddress, publicUrl } from "./web.ts";

test("internal addresses: loopback, private, link-local, CGNAT and their IPv6 forms", () => {
  for (const address of ["127.0.0.1", "10.8.0.1", "172.16.5.4", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd12::1", "fe80::1", "::ffff:10.0.0.1", "[::1]"]) {
    assert.equal(isInternalAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "172.32.0.1", "100.128.0.1", "51.170.50.52", "2a00:1450:4010::64", "::ffff:8.8.8.8"]) {
    assert.equal(isInternalAddress(address), false, address);
  }
});

test("only public http(s) addresses pass", async () => {
  await assert.rejects(publicUrl("file:///etc/passwd"), /Only http and https/);
  await assert.rejects(publicUrl("not a url"), /Not a web address/);
  await assert.rejects(publicUrl("http://127.0.0.1:38886/api"), /Internal addresses/);
  await assert.rejects(publicUrl("http://[::1]/"), /Internal addresses/);
  await assert.rejects(publicUrl("http://localhost/"), /Internal addresses/);
  assert.equal((await publicUrl("https://8.8.8.8/x")).href, "https://8.8.8.8/x");
});
