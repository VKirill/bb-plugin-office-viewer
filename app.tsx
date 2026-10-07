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
  // VK core function `image-editor`: an Edit button in BB's image preview for chat attachments.
  const vk = app.slots as typeof app.slots & {
    experimental_vkImageEditor?: (registration: { id: string; title: string; component: ComponentType<VkImageEditorProps> }) => void;
  };
  if (typeof vk.experimental_vkImageEditor === "function") {
    vk.experimental_vkImageEditor({ id: "image-editor", title: t("editImage"), component: ChatImageEditor });
  }
});
