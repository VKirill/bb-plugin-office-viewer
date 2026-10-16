// Office Viewer — a website on devices: the same mockups as HTML files, for an
// address on the web. The plugin server fetches the page and its files, so
// sites that refuse to be framed still show. A button beside BB's Browser
// address bar opens the current page here.
import { useMemo, useState } from "react";
import { useBbNavigate, useRpc, type PluginThreadPanelProps } from "@get-bb/plugin-sdk/app";
import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import type { rpcContract } from "../../server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "../shared/i18n";
import { decodeHtml, normalizeAddress } from "./capture";
import { DevicesViewer, type PageSource } from "./html";

export const SITE_PANEL = "site";
/** A tab opened from the panel's + menu has no params to keep its address in: it starts from the last one typed. */
const LAST_ADDRESS = "office-viewer:site-address";

const bytesOf = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

/** The panel tab: an address bar over the device viewer. */
export function SitePanel({ params }: PluginThreadPanelProps) {
  const rpc = useRpc<typeof rpcContract>();
  const passed = params && typeof params === "object" && !Array.isArray(params) && typeof params.url === "string" ? params.url : null;
  const initial = normalizeAddress(passed ?? (() => { try { return localStorage.getItem(LAST_ADDRESS) ?? ""; } catch { return ""; } })());
  const [url, setUrl] = useState<string | null>(initial);
  const [draft, setDraft] = useState(initial ?? "");
  const [invalid, setInvalid] = useState(false);

  const pages = useMemo<PageSource | null>(
    () =>
      url
        ? {
            async load() {
              const page = await rpc.call("webPage", { url });
              const finalUrl = new URL(page.finalUrl);
              return {
                html: decodeHtml(bytesOf(page.base64), page.contentType),
                base: finalUrl.href,
                // A site's pictures and fonts usually live anywhere on it, not beside the page.
                scope: `${finalUrl.origin}/`,
                openUrl: finalUrl.href,
                subtitle: finalUrl.host,
              };
            },
            async fetchFile(fileUrl) {
              const file = await rpc.call("webFile", { url: fileUrl });
              return new Blob([bytesOf(file.base64)], { type: file.contentType.split(";")[0] || "application/octet-stream" });
            },
          }
        : null,
    [rpc, url],
  );

  const submit = () => {
    const next = normalizeAddress(draft);
    setInvalid(!next);
    if (next) {
      setDraft(next);
      setUrl(next);
      try { localStorage.setItem(LAST_ADDRESS, next); } catch { /* private mode: nothing to remember */ }
    }
  };

  const heading = (
    <form
      className="flex min-w-0 flex-1 basis-56 items-center gap-1.5 px-1"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <HugeiconsIcon icon={Globe02Icon} size={16} className="shrink-0 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        placeholder={t("siteAddress")}
        aria-label={t("siteAddress")}
        aria-invalid={invalid}
        spellCheck={false}
        className="h-8 min-w-0 flex-1 font-mono text-xs"
      />
    </form>
  );

  if (!pages || !url) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex min-h-10 shrink-0 items-center border-b border-border px-2 py-1">{heading}</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <HugeiconsIcon icon={SmartPhone01Icon} size={28} />
          <span>{invalid ? t("siteInvalid") : t("siteEmpty")}</span>
        </div>
      </div>
    );
  }
  return <DevicesViewer key={url} pages={pages} title={new URL(url).host} address={url} heading={heading} />;
}

/** Beside BB's Browser address bar: opens the page in the device viewer. */
export function BrowserDevicesButton({ url }: { url: string }) {
  const navigate = useBbNavigate();
  const address = normalizeAddress(url);
  return (
    <span title={t("siteOpenDevices")} className="shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-foreground"
        aria-label={t("siteOpenDevices")}
        disabled={!address || !/^https?:/.test(url)}
        onClick={() => {
          if (address) navigate.openThreadPanel({ actionId: SITE_PANEL, title: new URL(address).host, params: { url: address } });
        }}
      >
        <HugeiconsIcon icon={SmartPhone01Icon} size={16} />
      </Button>
    </span>
  );
}
