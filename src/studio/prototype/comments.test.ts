import assert from "node:assert/strict";
import { test } from "node:test";
import { addComment, commentNumbersOnPage, commentsForPage, deleteComment, updateComment } from "./comments.ts";
import { getActivePage, newWireframe } from "./model.ts";

test("comments are stored per page and numbered", () => {
  const doc = newWireframe("App");
  const pageId = getActivePage(doc).id;
  let next = addComment(doc, { pageId, x: 16, y: 24, text: "First" });
  next = addComment(next, { pageId, x: 32, y: 40, text: "Second" });
  assert.equal(commentsForPage(next, pageId).length, 2);
  const numbers = commentNumbersOnPage(next, pageId);
  assert.equal(numbers.size, 2);
  next = updateComment(next, commentsForPage(next, pageId)[0]!.id, { resolved: true });
  assert.ok(commentNumbersOnPage(next, pageId).size === 2);
});

test("deleteComment removes entry", () => {
  const doc = newWireframe("Z");
  const pageId = getActivePage(doc).id;
  const withComment = addComment(doc, { pageId, x: 8, y: 8, text: "x" });
  const id = commentsForPage(withComment, pageId)[0]!.id;
  const cleared = deleteComment(withComment, id);
  assert.equal(commentsForPage(cleared, pageId).length, 0);
});
