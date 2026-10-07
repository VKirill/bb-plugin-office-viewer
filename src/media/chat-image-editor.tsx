// Office Viewer — the image editor inside BB's own image preview, for images
// attached to the chat. Needs the core function `image-editor` (VK EXPERIMENTAL):
// core passes the image URL and takes the edited PNG back, replacing a draft
// attachment or attaching it to the thread's draft.
import { useEffect, useState } from "react";
import { canvasFromBlob, ImageEditor } from "./image-editor";
import { t } from "../shared/i18n";

export type VkImageEditorProps = {
  src: string;
  name: string;
  target: "draft" | "message";
  done(file: File): Promise<void>;
  cancel(): void;
};

export function ChatImageEditor({ src, name, done, cancel }: VkImageEditorProps) {
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(src, { credentials: "include" })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then(canvasFromBlob)
      .then((canvas) => alive && setImage(canvas))
      .catch((cause: unknown) => alive && setError(cause instanceof Error ? cause.message : String(cause)));
    return () => void (alive = false);
  }, [src]);

  const stem = name.replace(/\.[^.]+$/, "") || "image";
  if (error) return <div role="alert" className="flex size-full items-center justify-center bg-background p-6 text-sm">{t("openFailed")}: {error}</div>;
  if (!image) return <div role="status" className="flex size-full items-center justify-center bg-background text-sm text-muted-foreground">{t("loading")}</div>;
  return (
    <ImageEditor
      image={image}
      name={name}
      overwriteFormat={null}
      write={null}
      onClose={cancel}
      onSaved={() => {}}
      onDone={(png) => done(new File([png], `${stem}-edited.png`, { type: "image/png" }))}
    />
  );
}
