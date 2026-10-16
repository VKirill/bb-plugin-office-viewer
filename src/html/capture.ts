// Office Viewer — screenshots of sandboxed pages. The page's HTML gets a <base>
// pointing at its folder and a small agent: on request it draws itself with
// modern-screenshot and posts the PNG back. Files from the site's folder reach
// it through the viewer, the only side allowed to read them.

export const SCREENSHOT_LIBRARY = "/api/v1/plugins/office-viewer/http/capture/modern-screenshot.js";

/** Bytes as text in the charset of the Content-Type header, else the one the page declares near its start; UTF-8 otherwise. */
export function decodeHtml(bytes: Uint8Array, contentType = ""): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const label = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(head)?.[1];
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
  var PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  var absolute = function (url) { try { return new URL(url, document.baseURI).href; } catch (e) { return url; } };
  // What is on the screen right now: its pictures are worth loading, and elements below or right of it can be left out
  // of the shot. A long page has far more of both than one screen.
  function onScreen() {
    var seen = {}, needed = new Set(), all = document.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i], box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight || box.right < 0 || box.left > innerWidth) continue;
      for (var up = el; up && !needed.has(up); up = up.parentElement) needed.add(up);
      if (el.currentSrc) seen[absolute(el.currentSrc)] = 1;
      else if (typeof el.src === "string" && el.src) seen[absolute(el.src)] = 1;
      if (el.poster) seen[absolute(el.poster)] = 1;
      var href = el.getAttribute && (el.getAttribute("href") || el.getAttribute("xlink:href"));
      if (href && el.tagName.toLowerCase() === "image") seen[absolute(href)] = 1;
      [null, "::before", "::after"].forEach(function (pseudo) {
        var background = getComputedStyle(el, pseudo).backgroundImage;
        if (background && background !== "none") background.replace(/url\\(["']?([^"')]+)["']?\\)/g, function (_, url) { seen[absolute(url)] = 1; return ""; });
      });
    }
    return { urls: seen, needed: needed };
  }
  // A sandboxed page can't read its stylesheets' rules, so the library would miss the web fonts: collect @font-face here.
  function fontFaces() {
    var sheets = [].slice.call(document.querySelectorAll("style")).map(function (style) { return Promise.resolve({ text: style.textContent || "", base: document.baseURI }); });
    [].slice.call(document.querySelectorAll('link[rel~="stylesheet"][href]')).forEach(function (link) {
      var url = absolute(link.getAttribute("href"));
      sheets.push(viaViewer(url).then(function (dataUrl) {
        if (dataUrl) return fetch(dataUrl).then(function (response) { return response.text(); });
        return fetch(url).then(function (response) { return response.ok ? response.text() : ""; });
      }).then(function (text) { return { text: text, base: url }; }, function () { return { text: "", base: url }; }));
    });
    // Only families the page has actually loaded; their files go in as data URLs, the picture can't load anything itself.
    var used = {};
    if (document.fonts) document.fonts.forEach(function (face) { if (face.status === "loaded") used[face.family.replace(/["']/g, "").toLowerCase()] = 1; });
    return Promise.all(sheets).then(function (list) {
      var css = list.map(function (sheet) {
        return (sheet.text.match(/@font-face\\s*{[^}]*}/g) || []).filter(function (rule) {
          var family = /font-family\\s*:\\s*([^;}]+)/i.exec(rule);
          return family && used[family[1].trim().replace(/["']/g, "").toLowerCase()];
        }).map(function (rule) {
          return rule.replace(/url\\(\\s*["']?([^"')]+)["']?\\s*\\)/g, function (_, url) { return 'url("' + new URL(url, sheet.base).href + '")'; });
        }).join("\\n");
      }).join("\\n");
      var urls = {};
      css.replace(/url\\("([^"]+)"\\)/g, function (_, url) { urls[url] = 1; return ""; });
      return Promise.all(Object.keys(urls).map(function (url) {
        return viaViewer(url).then(function (dataUrl) {
          return dataUrl || fetch(url).then(function (response) { return response.ok ? response.blob() : null; }).then(function (blob) {
            return blob && new Promise(function (resolve) { var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = function () { resolve(null); }; reader.readAsDataURL(blob); });
          });
        }).then(function (dataUrl) { return [url, dataUrl]; }, function () { return [url, null]; });
      })).then(function (pairs) {
        return pairs.reduce(function (text, pair) { return pair[1] ? text.split('url("' + pair[0] + '")').join('url("' + pair[1] + '")') : text; }, css);
      });
    });
  }
  var fontsReady = null;
  function fonts() { return fontsReady || (fontsReady = fontFaces()); }
  function viaViewer(url) {
    return new Promise(function (resolve) {
      var id = ++seq;
      pending[id] = resolve;
      parent.postMessage({ type: "ov-fetch", id: id, url: url }, "*");
      setTimeout(function () { if (pending[id]) { delete pending[id]; resolve(false); } }, 30000);
    });
  }
  addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== parent || !data) return;
    if (data.type === "ov-fetched") {
      if (pending[data.id]) { pending[data.id](data.dataUrl || false); delete pending[data.id]; }
      return;
    }
    // Shortly after the page loads: fetch what's on screen now, so a screenshot later doesn't wait for the network.
    if (data.type === "ov-warm") {
      var warm = onScreen().urls;
      Object.keys(warm).forEach(function (url) { if (url.indexOf("data:") !== 0) viaViewer(url); });
      fonts();
      return;
    }
    if (data.type !== "ov-capture") return;
    var reply = function (message) { message.type = "ov-captured"; message.id = data.id; parent.postMessage(message, "*"); };
    if (typeof modernScreenshot === "undefined") return reply({ error: "modern-screenshot did not load" });
    var screen = onScreen(), visible = screen.urls;
    // Default styles measured in a shadow root, which page CSS doesn't reach: the shot keeps only what the page changed.
    // (The library's own way, a hidden iframe, can't be read from a sandboxed page.)
    var host = document.createElement("div");
    host.style.cssText = "all: initial; position: fixed; left: -9999px; top: 0; width: 0; height: 0; overflow: hidden; visibility: hidden";
    document.documentElement.appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });
    var defaults = {
      contentWindow: {
        document: { body: shadow, createElement: function (name) { return document.createElement(name); }, createElementNS: function (ns, name) { return document.createElementNS(ns, name); } },
        getComputedStyle: function (el, pseudo) { return getComputedStyle(el, pseudo); },
      },
      remove: function () { host.remove(); },
    };
    var keep = function (node) {
      if (node === host) return false;
      if (node.nodeType !== 1 || screen.needed.has(node)) return true;
      var box = node.getBoundingClientRect();
      return box.top < innerHeight && box.left < innerWidth;
    };
    // The library waits for every picture on the page to load, and a lazy one below the screen never does: it would
    // sit out the whole timeout. Off-screen pictures that haven't loaded step aside for a same-sized stand-in meanwhile.
    var parked = [];
    [].slice.call(document.querySelectorAll("img, video")).forEach(function (el) {
      if (el.tagName === "IMG" ? el.complete : el.readyState >= 2) return;
      var box = el.getBoundingClientRect();
      if (box.top < innerHeight && box.bottom > 0 && box.left < innerWidth && box.right > 0) return;
      var stand = document.createElement("span");
      stand.style.cssText = "display:inline-block;width:" + box.width + "px;height:" + box.height + "px";
      el.replaceWith(stand);
      parked.push([stand, el]);
    });
    var restore = function () { host.remove(); parked.forEach(function (pair) { pair[0].replaceWith(pair[1]); }); };
    var fetchFor = function (url) {
      if (url.indexOf("data:") === 0) return Promise.resolve(false);
      var font = /\\.(woff2?|ttf|otf|eot)(\\?|#|$)/i.test(url) || /fonts\\.gstatic\\.com/.test(url);
      if (!font && !/\\.css(\\?|#|$)/i.test(url) && !visible[absolute(url)]) return Promise.resolve(PIXEL);
      return viaViewer(url);
    };
    fonts().then(function (cssText) { return modernScreenshot.createContext(document.documentElement, {
      font: cssText ? { cssText: cssText } : undefined,
      width: innerWidth,
      height: innerHeight,
      scale: data.scale || 1,
      backgroundColor: "#ffffff",
      style: { transform: "translate(" + -scrollX + "px, " + -scrollY + "px)" },
      quality: 0.9,
      timeout: 3000,
      filter: keep,
      fetchFn: fetchFor,
    }); }).then(function (context) {
      context.sandbox = defaults;
      return modernScreenshot.domToJpeg(context);
    }).then(function (url) { restore(); reply({ url: url }); }, function (error) { restore(); reply({ error: String((error && error.message) || error) }); });
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

/** What the user typed as an address: a scheme is added when missing. */
export function normalizeAddress(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
