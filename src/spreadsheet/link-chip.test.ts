import assert from "node:assert/strict";
import { test } from "node:test";
import { linkIcon, linkLabel } from "./link-chip.ts";

test("linkLabel strips http(s) and one trailing slash", () => {
  assert.equal(linkLabel("https://github.com/get-bb/bb"), "github.com/get-bb/bb");
  assert.equal(linkLabel("https://github.com/get-bb/bb/"), "github.com/get-bb/bb");
  assert.equal(linkLabel("http://example.com"), "example.com");
  assert.equal(linkLabel("HTTP://Example.com/path/"), "Example.com/path");
  assert.equal(linkLabel("https://t.me/neuro"), "t.me/neuro");
});

test("linkLabel leaves non-URLs unchanged", () => {
  assert.equal(linkLabel("not a url"), "not a url");
  assert.equal(linkLabel("ftp://files.example.com"), "ftp://files.example.com");
  assert.equal(linkLabel("github.com/get-bb/bb"), "github.com/get-bb/bb");
});

test("linkIcon maps brand hosts including www and subdomains", () => {
  assert.equal(linkIcon("https://github.com/get-bb/bb"), "Github");
  assert.equal(linkIcon("https://www.github.com/get-bb/bb"), "Github");
  assert.equal(linkIcon("https://gist.github.com/a/b"), "Github");
  assert.equal(linkIcon("https://www.figma.com/file/abc"), "Figma");
  assert.equal(linkIcon("https://notion.so/page"), "Notion");
  assert.equal(linkIcon("https://acme.notion.site/page"), "Notion");
  assert.equal(linkIcon("https://app.slack.com/client"), "Slack");
  assert.equal(linkIcon("https://t.me/neuro"), "Telegram");
  assert.equal(linkIcon("https://telegram.org/blog"), "Telegram");
  assert.equal(linkIcon("https://youtube.com/watch?v=1"), "Youtube");
  assert.equal(linkIcon("https://youtu.be/abc"), "Youtube");
  assert.equal(linkIcon("https://docs.google.com/document/d/1"), "FileText");
  assert.equal(linkIcon("https://drive.google.com/file/d/1"), "FileText");
});

test("linkIcon falls back to Globe for other hosts", () => {
  assert.equal(linkIcon("https://example.com/a"), "Globe");
  assert.equal(linkIcon("https://localhost:3000/"), "Globe");
  assert.equal(linkIcon("https://127.0.0.1/"), "Globe");
  assert.equal(linkIcon("https://[::1]/"), "Globe");
  assert.equal(linkIcon("https://notgithub.com/"), "Globe");
  assert.equal(linkIcon("not a url"), "Globe");
});
