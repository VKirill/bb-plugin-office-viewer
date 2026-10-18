import { snap, type Wireframe, type WireframeComment } from "./model.ts";

export type { WireframeComment };

let nextCommentId = 0;

export function newCommentId(): string {
  return `cmt_${Date.now().toString(36)}_${(++nextCommentId).toString(36)}`;
}

export function commentsForPage(doc: Wireframe, pageId: string): WireframeComment[] {
  return (doc.comments ?? []).filter((item) => item.pageId === pageId);
}

export function activeCommentsForPage(doc: Wireframe, pageId: string): WireframeComment[] {
  return commentsForPage(doc, pageId).filter((item) => !item.resolved);
}

/** Stable 1-based numbers per page (unresolved first, then resolved). */
export function commentNumbersOnPage(doc: Wireframe, pageId: string): Map<string, number> {
  const list = commentsForPage(doc, pageId);
  const ordered = [...list.filter((c) => !c.resolved), ...list.filter((c) => c.resolved)];
  return new Map(ordered.map((item, index) => [item.id, index + 1]));
}

export function addComment(
  doc: Wireframe,
  input: { pageId: string; x: number; y: number; elementId?: string; text: string },
): Wireframe {
  const comment: WireframeComment = {
    id: newCommentId(),
    pageId: input.pageId,
    x: snap(input.x),
    y: snap(input.y),
    elementId: input.elementId,
    text: input.text.trim(),
  };
  return { ...doc, comments: [...(doc.comments ?? []), comment] };
}

export function updateComment(doc: Wireframe, id: string, patch: Partial<Pick<WireframeComment, "text" | "resolved">>): Wireframe {
  const comments = doc.comments ?? [];
  if (!comments.some((item) => item.id === id)) return doc;
  return {
    ...doc,
    comments: comments.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

export function deleteComment(doc: Wireframe, id: string): Wireframe {
  const comments = doc.comments ?? [];
  return { ...doc, comments: comments.filter((item) => item.id !== id) };
}
