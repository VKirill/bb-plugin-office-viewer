export type StudioTool = "prototype" | "paint" | "slides";

/** Maps a panel tab's persisted params to a studio tool, or null for the launcher. */
export function studioToolOf(params: unknown): StudioTool | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const tool = "tool" in params ? params.tool : undefined;
  return tool === "prototype" || tool === "paint" || tool === "slides" ? tool : null;
}
