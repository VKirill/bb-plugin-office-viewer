import { boardElements, childrenOf } from "./containers.ts";
import { isAutoLayoutStack, resolvePageView, stackFlexStyle, type PageDeviceView } from "./layout.ts";
import type { ElementType, PropValue, Wireframe, WireframeElement, WireframePage } from "./model.ts";

export type CodeExportFile = { fileName: string; content: string };

function slugComponentName(pageName: string): string {
  const parts = pageName
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  const name = parts.join("") || "Screen";
  return /^[A-Z]/.test(name) ? `${name}Page` : `Screen${name}`;
}

function escapeTsx(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$").replace(/"/g, '\\"');
}

function propString(props: Record<string, PropValue>, key: string, fallback = ""): string {
  const value = props[key];
  return typeof value === "string" ? value : fallback;
}

function semanticTag(el: WireframeElement): { tag: string; selfClosing?: boolean } {
  switch (el.type) {
    case "Button":
      return { tag: "button" };
    case "TextField":
    case "SearchField":
    case "DatePicker":
      return { tag: "input", selfClosing: true };
    case "TextArea":
      return { tag: "textarea" };
    case "Header":
      return { tag: "header" };
    case "Nav":
      return { tag: "nav" };
    case "Table":
      return { tag: "table" };
    case "Label":
      return { tag: "label" };
    case "Heading": {
      const level = typeof el.props.level === "number" ? Math.min(3, Math.max(1, el.props.level)) : 1;
      return { tag: `h${level}` };
    }
    case "Image":
      return { tag: "img", selfClosing: true };
    case "Divider":
      return { tag: "hr", selfClosing: true };
    case "Checkbox":
      return { tag: "input", selfClosing: true };
    default:
      return { tag: "div" };
  }
}

function tailwindFor(el: WireframeElement): string {
  if (isAutoLayoutStack(el)) return "relative flex overflow-hidden";
  const base = "absolute overflow-hidden";
  switch (el.type) {
    case "Button":
      return `${base} inline-flex items-center justify-center rounded-md bg-primary px-3 text-sm text-primary-foreground`;
    case "TextField":
    case "TextArea":
    case "SearchField":
      return `${base} rounded-md border border-input bg-background px-3 text-sm`;
    case "Card":
      return `${base} rounded-lg border border-border bg-card p-3 shadow-sm`;
    case "Header":
      return `${base} flex items-center bg-foreground px-4 text-sm font-semibold text-background`;
    case "Nav":
      return `${base} flex items-center gap-3 border-b border-border bg-card px-3 text-sm`;
    default:
      return base;
  }
}

function elementAttributes(el: WireframeElement): string {
  const attrs: string[] = [];
  if (el.type === "TextField" || el.type === "SearchField") {
    attrs.push('type="text"');
    const placeholder = propString(el.props, "placeholder");
    if (placeholder) attrs.push(`placeholder="${escapeTsx(placeholder)}"`);
  }
  if (el.type === "Checkbox") attrs.push('type="checkbox"');
  if (el.type === "Image") {
    const alt = propString(el.props, "alt", "Image");
    attrs.push(`alt="${escapeTsx(alt)}"`);
  }
  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

function elementInner(el: WireframeElement): string {
  if (el.type === "Image" || el.type === "Divider" || el.type === "TextField" || el.type === "SearchField" || el.type === "Checkbox") {
    return "";
  }
  const text =
    propString(el.props, "text") ||
    propString(el.props, "title") ||
    propString(el.props, "label") ||
    el.label;
  return escapeTsx(text);
}

function styleObjectLiteral(style: Record<string, string | number>, absX: number, absY: number, el: WireframeElement): string {
  const parts = [`left: ${absX}`, `top: ${absY}`, `width: ${el.w}`, `height: ${el.h}`];
  for (const [key, value] of Object.entries(style)) {
    const cssKey = key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    parts.push(`${cssKey}: ${typeof value === "number" ? value : `"${value}"`}`);
  }
  return `{ ${parts.join(", ")} }`;
}

function renderElement(el: WireframeElement, elements: readonly WireframeElement[], absX: number, absY: number, indent: string): string {
  const { tag, selfClosing } = semanticTag(el);
  const className = tailwindFor(el);
  const attrs = elementAttributes(el);
  const flex = isAutoLayoutStack(el) ? stackFlexStyle(el) : {};
  const styleExpr = styleObjectLiteral(flex, absX, absY, el);
  if (isAutoLayoutStack(el)) {
    const kids = childrenOf(elements, el.id);
    const inner = kids.map((child) => renderElement(child, elements, child.x, child.y, `${indent}  `)).join("\n");
    return `${indent}<div className="${className}" style={${styleExpr}}>\n${inner}\n${indent}</div>`;
  }
  if (selfClosing) {
    return `${indent}<${tag} className="${className}" style={${styleExpr}}${attrs} />`;
  }
  const inner = elementInner(el);
  return `${indent}<${tag} className="${className}" style={${styleExpr}}${attrs}>${inner}</${tag}>`;
}

function renderPageElements(page: WireframePage): string {
  const placed = boardElements(page.elements, { kind: "page" });
  return placed
    .map(({ element, absX, absY }) => renderElement(element, page.elements, absX, absY, "      "))
    .join("\n");
}

export function buildPageComponent(page: WireframePage): CodeExportFile {
  const componentName = slugComponentName(page.name);
  const body = renderPageElements(page);
  const content = `/** Generated starting point — adjust layout and styles. */\nexport function ${componentName}() {\n  return (\n    <div\n      className="relative bg-background"\n      style={{ width: ${page.canvas.width}, height: ${page.canvas.height}, background: "${page.canvas.background}" }}\n    >\n${body}\n    </div>\n  );\n}\n`;
  return { fileName: `${componentName}.tsx`, content };
}

export function buildWireframeCodeExport(doc: Wireframe, deviceView: PageDeviceView = "desktop"): { readme: string; files: CodeExportFile[] } {
  const files = doc.pages.map((page) => buildPageComponent(resolvePageView(page, deviceView)));
  const readme = [
    `# ${doc.name} — generated React components`,
    "",
    "Starting point only: absolute layout with Tailwind-style class names. Refine structure before shipping.",
    "",
    "## Pages",
    "",
    ...files.map((file) => `- \`${file.fileName}\``),
    "",
  ].join("\n");
  return { readme, files };
}

export function isFormSemanticTag(type: ElementType): boolean {
  return type === "Button" || type === "TextField" || type === "TextArea" || type === "Label" || type === "SearchField";
}
