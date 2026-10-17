import { PrototypeBuilder } from "./prototype/builder";
import { PaintCanvas } from "./paint/paint";
import { SlidesEditor } from "./slides/editor";

export function PrototypeTool({ threadId }: { threadId: string }) {
  return <PrototypeBuilder threadId={threadId} />;
}

export function PaintTool({ threadId }: { threadId: string }) {
  return <PaintCanvas threadId={threadId} />;
}

export function SlidesTool({ threadId }: { threadId: string }) {
  return <SlidesEditor threadId={threadId} />;
}
