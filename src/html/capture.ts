// Office Viewer — screenshots of sandboxed pages. The page's HTML gets a <base>
// pointing at its folder and a small agent: on request it draws itself with
// modern-screenshot and posts the PNG back. Files from the site's folder reach
// it through the viewer, the only side allowed to read them.

export const SCREENSHOT_LIBRARY = "/api/v1/plugins/office-viewer/http/capture/modern-screenshot.js";

/** Bytes as text in the charset the page declares near its start; UTF-8 otherwise. */
export function decodeHtml(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const label = /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(head)?.[1];
  try {
    return new TextDecoder(label || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const attribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Runs inside the page. Messages: ov-capture → ov-captured; ov-fetch ← → ov-fetched. */
const AGENT = `(function () {
  var pending = {}, seq = 0;
  function viaViewer(url) {
    return new Promise(function (resolve) {
      var id = ++seq;
      pending[id] = resolve;
      parent.postMessage({ type: "ov-fetch", id: id, url: url }, "*");
      setTimeout(function () { if (pending[id]) { delete pending[id]; resolve(false); } }, 15000);
    });
  }
  addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== parent || !data) return;
    if (data.type === "ov-fetched") {
      if (pending[data.id]) { pending[data.id](data.dataUrl || false); delete pending[data.id]; }
      return;
    }
    if (data.type !== "ov-capture") return;
    var reply = function (message) { message.type = "ov-captured"; message.id = data.id; parent.postMessage(message, "*"); };
    if (typeof modernScreenshot === "undefined") return reply({ error: "modern-screenshot did not load" });
    modernScreenshot.createContext(document.documentElement, {
      width: innerWidth,
      height: innerHeight,
      scale: data.scale || 1,
      backgroundColor: "#ffffff",
      style: { transform: "translate(" + -scrollX + "px, " + -scrollY + "px)" },
      fetchFn: viaViewer,
    }).then(function (context) {
      // The library measures default styles in a hidden iframe, which a sandboxed page can't read: without it, every computed style is kept.
      context.sandbox = { contentWindow: null, remove: function () {} };
      return modernScreenshot.domToPng(context);
    }).then(function (url) { reply({ url: url }); }, function (error) { reply({ error: String((error && error.message) || error) }); });
  });
})();`;

/**
 * The page with the capture agent, its relative links resolved against `baseUrl` (the site's folder). A page that
 * sets its own <base> keeps it.
 */
export function prepareHtml(html: string, baseUrl: string): string {
  const inject = `${/<base\s/i.test(html) ? "" : `<base href="${attribute(baseUrl)}">`}<script src="${SCREENSHOT_LIBRARY}"></script><script>${AGENT}</script>`;
  for (const tag of [/<head\b[^>]*>/i, /<html\b[^>]*>/i]) {
    const match = tag.exec(html);
    if (match) return html.slice(0, match.index + match[0].length) + inject + html.slice(match.index + match[0].length);
  }
  return inject + html;
}

/** Only files under the site's folder are read for the page: the viewer's session must not leak to it. */
export const insideSite = (url: string, baseUrl: string) => {
  try {
    const target = new URL(url, baseUrl);
    const base = new URL(baseUrl);
    return target.origin === base.origin && target.pathname.startsWith(base.pathname) && !target.pathname.slice(base.pathname.length).split("/").includes("..");
  } catch {
    return false;
  }
};
