import { boardElements, type EditScope } from "./containers.ts";
import { commentNumbersOnPage, commentsForPage, type WireframeComment } from "./comments.ts";
import type { InteractionAction } from "./interactions.ts";
import { resolvePageView, type PageDeviceView } from "./layout.ts";
import type { PropValue, Wireframe, WireframeElement, WireframePage } from "./model.ts";

export type SpecPageImage = {
  pageId: string;
  relPath: string;
};

function slugFilePart(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "page";
}

export function specImageRelPath(stem: string, page: WireframePage): string {
  return `${stem}.spec/${slugFilePart(page.name)}.png`;
}

function propText(props: Record<string, PropValue>, key: string): string | undefined {
  const value = props[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function describeProps(el: WireframeElement): string {
  const bits: string[] = [];
  for (const key of ["text", "title", "placeholder", "label", "alt", "variant", "url"]) {
    const value = propText(el.props, key);
    if (value) bits.push(`${key}="${value}"`);
  }
  if (el.note) bits.push(`note="${el.note.replace(/\s+/g, " ").slice(0, 120)}"`);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

function describeAction(action: InteractionAction, pageNameById: Map<string, string>): string {
  switch (action.type) {
    case "openLink":
      return `open link ${action.url ?? ""}${action.target === "_blank" ? " in new tab" : ""}`;
    case "goToPage":
      return `go to page ${pageNameById.get(action.pageId ?? "") ?? action.pageId ?? "?"}`;
    case "show":
      return `show element ${action.targetId ?? "?"}`;
    case "hide":
      return `hide element ${action.targetId ?? "?"}`;
    case "toggle":
      return `toggle visibility of ${action.targetId ?? "?"}`;
    case "setPanelState":
      return `set panel ${action.targetId ?? "?"} to state ${action.state ?? "?"}`;
    case "setText":
      return `set text on ${action.targetId ?? "?"} to "${action.text ?? ""}"`;
    case "setSelected":
      return `set selection on ${action.targetId ?? "?"} to "${action.value ?? ""}"`;
    case "scrollTo":
      return `scroll to ${action.targetId ?? "?"}`;
    case "wait":
      return `wait ${action.ms ?? 0} ms`;
    default:
      return action.type;
  }
}

function describeInteractions(el: WireframeElement, pageNameById: Map<string, string>): string[] {
  const lines: string[] = [];
  for (const ix of el.interactions ?? []) {
    for (const caseItem of ix.cases) {
      const actions = caseItem.actions.map((action) => describeAction(action, pageNameById)).join("; ");
      if (!actions) continue;
      lines.push(`- ${el.label} · ${ix.event}${caseItem.name ? ` (${caseItem.name})` : ""}: ${actions}`);
    }
  }
  return lines;
}

function describeElementTree(page: WireframePage, scope: EditScope, depth = 0): string[] {
  const placed = boardElements(page.elements, scope);
  const lines: string[] = [];
  for (const { element: el, absX, absY } of placed) {
    const indent = "  ".repeat(depth);
    lines.push(`${indent}- ${el.type} · ${el.label}${describeProps(el)} @ ${absX}×${absY} ${el.w}×${el.h}`);
    if (el.type === "Container") {
      lines.push(...describeElementTree(page, { kind: "container", containerId: el.id }, depth + 1));
    }
    if (el.type === "DynamicPanel") {
      const active = typeof el.props.active === "string" ? el.props.active : "State 1";
      lines.push(...describeElementTree(page, { kind: "panel", panelId: el.id, state: active }, depth + 1));
    }
  }
  return lines;
}

function formatCommentLine(comment: WireframeComment, number: number): string {
  const anchor = comment.elementId ? ` (element ${comment.elementId})` : "";
  const status = comment.resolved ? " [resolved]" : "";
  return `${number}. @ ${comment.x}×${comment.y}${anchor}${status}: ${comment.text}`;
}

export function buildWireframeSpecMarkdown(
  doc: Wireframe,
  stem: string,
  images: SpecPageImage[],
  deviceView: PageDeviceView = "desktop",
): string {
  const imageByPage = new Map(images.map((item) => [item.pageId, item.relPath]));
  const pageNameById = new Map(doc.pages.map((page) => [page.id, page.name]));
  const lines: string[] = [
    `# ${doc.name} — wireframe specification`,
    "",
    `Generated from \`${stem}.wireframe.json\`. Element positions are in px on an 8px grid.`,
    "",
  ];

  for (const page of doc.pages) {
    const resolved = resolvePageView(page, deviceView);
    const numbers = commentNumbersOnPage(doc, page.id);
    lines.push(`## ${page.name}`, "");
    if (deviceView !== "desktop") {
      lines.push(`Device view: ${deviceView}.`, "");
    }
    lines.push(`Canvas: ${resolved.canvas.width}×${resolved.canvas.height}, background ${resolved.canvas.background}.`, "");
    const rel = imageByPage.get(page.id);
    if (rel) {
      lines.push(`![${page.name}](${rel})`, "");
    }
    if (page.notes?.trim()) {
      lines.push("### Page notes", "", page.notes.trim(), "");
    }
    const pageComments = commentsForPage(doc, page.id);
    if (pageComments.length) {
      lines.push("### Comments", "");
      for (const comment of pageComments) {
        lines.push(formatCommentLine(comment, numbers.get(comment.id) ?? 0));
      }
      lines.push("");
    }
    lines.push("### Elements", "", ...describeElementTree(resolved, { kind: "page" }), "");
    const ixLines: string[] = [];
    for (const el of resolved.elements) ixLines.push(...describeInteractions(el, pageNameById));
    if (ixLines.length) {
      lines.push("### Interactions", "", ...ixLines, "");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export function buildImplementFromSpecPrompt(specAbsPath: string): string {
  return [
    "Implement these screens in the project using the attached wireframe specification and annotated PNGs.",
    "",
    `Specification: ${specAbsPath}`,
    "",
    "Match layout, copy, and hierarchy. Use the numbered pins and element list in the spec.",
  ].join("\n");
}
