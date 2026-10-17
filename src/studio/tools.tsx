import type { ComponentType } from "react";
import { PrototypeBuilder } from "./prototype/builder";
import { PaintCanvas } from "./paint/paint";
import { SlidesEditor } from "./slides/editor";
import type { StudioTool } from "./studio-tool";

export function PrototypeTool({ threadId }: { threadId: string }) {
  return <PrototypeBuilder threadId={threadId} />;
}

export function PaintTool({ threadId }: { threadId: string }) {
  return <PaintCanvas threadId={threadId} />;
}

export function SlidesTool({ threadId }: { threadId: string }) {
  return <SlidesEditor threadId={threadId} />;
}

const TOOL_BY_ID: Record<StudioTool, ComponentType<{ threadId: string }>> = {
  prototype: PrototypeTool,
  paint: PaintTool,
  slides: SlidesTool,
};

export function StudioToolView({ tool, threadId }: { tool: StudioTool; threadId: string }) {
  const View = TOOL_BY_ID[tool];
  return <View threadId={threadId} />;
}
