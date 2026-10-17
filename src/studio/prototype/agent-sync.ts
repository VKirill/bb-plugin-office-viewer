import type { Wireframe } from "./model.ts";

export async function wireframeContentSha256(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isOwnWireframeWrite(remoteHash: string, lastWrittenHash: string | null): boolean {
  return lastWrittenHash !== null && remoteHash === lastWrittenHash;
}

export function shouldApplyRemoteWireframe(remoteHash: string, lastWrittenHash: string | null, lastAppliedRemoteHash: string | null): boolean {
  if (isOwnWireframeWrite(remoteHash, lastWrittenHash)) return false;
  if (lastAppliedRemoteHash !== null && remoteHash === lastAppliedRemoteHash) return false;
  return true;
}

export function replaceWireframeFromRemote(_current: Wireframe, incoming: Wireframe): Wireframe {
  return incoming;
}
