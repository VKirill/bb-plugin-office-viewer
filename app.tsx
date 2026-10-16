// Office Viewer — frontend entry: registers the file openers. BB routes files
// here by extension from chat links, the file picker and `bb thread open`.
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import type { ComponentType } from "react";
import { t } from "./src/shared/i18n";
import { EXTENSIONS } from "./src/spreadsheet/sheet";
import { SpreadsheetOpener } from "./src/spreadsheet/opener";
import { MEDIA_EXTENSIONS, MediaOpener } from "./src/media/media";
import { ChatImageEditor, type VkImageEditorProps } from "./src/media/chat-image-editor";
import { DocumentOpener, WORD_EXTENSIONS } from "./src/word/document";
import { SLIDES_EXTENSIONS, SlidesOpener } from "./src/slides/slides";
import { PDF_EXTENSIONS, PdfOpener } from "./src/pdf/pdf";
import { HTML_EXTENSIONS, HtmlOpener } from "./src/html/html";
import { BrowserDevicesButton, SITE_PANEL, SitePanel } from "./src/html/site";

export default definePluginApp((app) => {
  app.slots.fileOpener({
    id: "spreadsheet",
    title: "Office Viewer",
    extensions: EXTENSIONS,
    component: SpreadsheetOpener,
  });
  app.slots.fileOpener({
    id: "media",
    title: "Office Viewer — media",
    extensions: MEDIA_EXTENSIONS,
    component: MediaOpener,
  });
  app.slots.fileOpener({
    id: "word",
    title: "Office Viewer — Word",
    extensions: WORD_EXTENSIONS,
    component: DocumentOpener,
  });
  app.slots.fileOpener({
    id: "slides",
    title: "Office Viewer — PowerPoint",
    extensions: SLIDES_EXTENSIONS,
    component: SlidesOpener,
  });
  app.slots.fileOpener({
    id: "pdf",
    title: "Office Viewer — PDF",
    extensions: PDF_EXTENSIONS,
    component: PdfOpener,
  });
  app.slots.fileOpener({
    id: "html",
    title: "Office Viewer — HTML layout",
    extensions: HTML_EXTENSIONS,
    component: HtmlOpener,
  });
  app.slots.threadPanelAction({ id: SITE_PANEL, title: t("siteDevices"), icon: "Globe", layout: "flush", component: SitePanel });
  // A button beside BB's Browser address bar (BB 0.46+); older hosts don't have the slot.
  const browser = app.slots as typeof app.slots & {
    experimental_browserToolbarAction?: (registration: { id: string; title: string; component: ComponentType<{ url: string }> }) => void;
  };
  if (typeof browser.experimental_browserToolbarAction === "function") {
    browser.experimental_browserToolbarAction({ id: "devices", title: t("siteOpenDevices"), component: BrowserDevicesButton });
  }
  // VK core function `image-editor`: an Edit button in BB's image preview for chat attachments.
  const vk = app.slots as typeof app.slots & {
    experimental_vkImageEditor?: (registration: { id: string; title: string; component: ComponentType<VkImageEditorProps> }) => void;
  };
  if (typeof vk.experimental_vkImageEditor === "function") {
    vk.experimental_vkImageEditor({ id: "image-editor", title: t("editImage"), component: ChatImageEditor });
  }
});
