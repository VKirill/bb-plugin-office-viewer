import { PrototypeBuilder } from "./prototype/builder";
import { PaintCanvas } from "./paint/paint";

export function PrototypeTool({ threadId }: { threadId: string }) {
  return <PrototypeBuilder threadId={threadId} />;
}

export function PaintTool({ threadId }: { threadId: string }) {
  return <PaintCanvas threadId={threadId} />;
}
