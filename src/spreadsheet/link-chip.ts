const URL_RE = /^https?:\/\/\S+$/i;

const HOST_ICONS: { domain: string; icon: string }[] = [
  { domain: "github.com", icon: "Github" },
  { domain: "figma.com", icon: "Figma" },
  { domain: "notion.so", icon: "Notion" },
  { domain: "notion.site", icon: "Notion" },
  { domain: "slack.com", icon: "Slack" },
  { domain: "t.me", icon: "Telegram" },
  { domain: "telegram.org", icon: "Telegram" },
  { domain: "youtube.com", icon: "Youtube" },
  { domain: "youtu.be", icon: "Youtube" },
  { domain: "docs.google.com", icon: "FileText" },
  { domain: "drive.google.com", icon: "FileText" },
];

/** URL shown in a cell chip: scheme stripped, one trailing slash dropped. */
export function linkLabel(url: string): string {
  if (!URL_RE.test(url)) return url;
  let rest = url.replace(/^https?:\/\//i, "");
  if (rest.endsWith("/")) rest = rest.slice(0, -1);
  return rest;
}

/** Builtin icon name for a URL host; unknown hosts use Globe. */
export function linkIcon(url: string): string {
  const host = hostOf(url);
  if (!host) return "Globe";
  for (const { domain, icon } of HOST_ICONS) {
    if (host === domain || host.endsWith(`.${domain}`)) return icon;
  }
  return "Globe";
}

function hostOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}
