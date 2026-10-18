import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "../../shared/i18n";

export function CommentComposeDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (text: string) => void;
}) {
  const t = useT();
  const [text, setText] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setText("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("protoCommentAddTitle")}</DialogTitle>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("protoCommentPlaceholder")}
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button
            type="button"
            disabled={!text.trim()}
            onClick={() => {
              onSubmit(text.trim());
              setText("");
              onOpenChange(false);
            }}
          >
            {t("protoCommentSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
