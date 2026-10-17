export type AgentGenerateDevice = "desktop" | "tablet" | "phone";
export type AgentGenerateFidelity = "low" | "medium" | "high";

const DEVICE_CANVAS: Record<AgentGenerateDevice, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 375, height: 812 },
};

export function deviceCanvasSize(device: AgentGenerateDevice): { width: number; height: number } {
  return DEVICE_CANVAS[device];
}

export function buildTextGeneratePrompt(opts: {
  description: string;
  device: AgentGenerateDevice;
  fidelity: AgentGenerateFidelity;
  schemaAbsPath: string;
  wireframeAbsPath: string;
}): string {
  const { width, height } = deviceCanvasSize(opts.device);
  return [
    "Create or update a BB Office Studio wireframe JSON file for this screen.",
    "",
    `Target file (write valid JSON here): ${opts.wireframeAbsPath}`,
    `Schema reference (read first): ${opts.schemaAbsPath}`,
    "",
    `Canvas: ${width}×${height} px (${opts.device}). Fidelity: ${opts.fidelity}.`,
    "",
    "Requirements:",
    "- format \"bb-wireframe\", version 2",
    "- Use element types and props from WIREFRAME_SCHEMA.md",
    "- Snap positions to an 8px grid",
    "- Keep labels unique and descriptive",
    "",
    "Screen description:",
    opts.description.trim(),
  ].join("\n");
}

export function buildScreenshotGeneratePrompt(opts: {
  description: string;
  schemaAbsPath: string;
  wireframeAbsPath: string;
  refAbsPath: string;
}): string {
  const extra = opts.description.trim() ? `\n\nNotes:\n${opts.description.trim()}` : "";
  return [
    "Recreate this screenshot as a BB Office Studio wireframe JSON file.",
    "",
    `Reference image: ${opts.refAbsPath}`,
    `Target file: ${opts.wireframeAbsPath}`,
    `Schema: ${opts.schemaAbsPath}`,
    "",
    "Match layout, hierarchy, and copy. Use wireframe elements (not a bitmap). Keep the trace Image layer if present.",
    extra,
  ].join("\n");
}

export function slugWireframeStem(description: string, fallback = "screen"): string {
  const slug = description
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}
