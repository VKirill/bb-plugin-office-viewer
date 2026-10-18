import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "../../shared/i18n";
import {
  getStyleLibrary,
  mergeDesignImport,
  newColorToken,
  newTextStyle,
  parseDesignMarkdown,
  setStyleLibrary,
  updateColorTokenInLibrary,
  updateTextStyleInLibrary,
} from "./styles";
import type { Wireframe, WireframeElement } from "./model";

export function PrototypeStylesPane({
  doc,
  selection,
  onDocChange,
  onApplyColorToken,
  onApplyTextStyle,
  onImportMarkdown,
}: {
  doc: Wireframe;
  selection: WireframeElement[];
  onDocChange: (next: Wireframe) => void;
  onApplyColorToken: (tokenId: string) => void;
  onApplyTextStyle: (styleId: string) => void;
  onImportMarkdown: () => Promise<string | null>;
}) {
  const t = useT();
  const library = getStyleLibrary(doc);
  const one = selection.length === 1 ? selection[0]! : null;

  const patchLibrary = (next: ReturnType<typeof getStyleLibrary>) => onDocChange(setStyleLibrary(doc, next));

  const importDesign = async () => {
    const markdown = await onImportMarkdown();
    if (!markdown) return;
    patchLibrary(mergeDesignImport(library, parseDesignMarkdown(markdown)));
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => patchLibrary({ ...library, colors: [...library.colors, newColorToken(t("protoStyleNewColor"), "#64748b")] })}>
          {t("protoStyleAddColor")}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => patchLibrary({ ...library, text: [...library.text, newTextStyle(t("protoStyleNewText"))] })}>
          {t("protoStyleAddText")}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => void importDesign()}>
          {t("protoStyleImportDesign")}
        </Button>
      </div>
      <div>
        <div className="mb-1 font-medium text-muted-foreground">{t("protoStyleColors")}</div>
        <ul className="space-y-1">
          {library.colors.map((token) => (
            <li key={token.id} className="flex items-center gap-1 rounded border border-border p-1">
              <span className="size-5 shrink-0 rounded border border-border" style={{ background: token.value }} />
              <Input className="h-7 min-w-0 flex-1" value={token.name} onChange={(e) => patchLibrary(updateColorTokenInLibrary(library, token.id, { name: e.target.value }))} />
              <Input className="h-7 w-24" value={token.value} onChange={(e) => patchLibrary(updateColorTokenInLibrary(library, token.id, { value: e.target.value }))} />
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" disabled={!one} onClick={() => onApplyColorToken(token.id)}>
                {t("protoStyleApply")}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-1 font-medium text-muted-foreground">{t("protoStyleTextStyles")}</div>
        <ul className="space-y-1">
          {library.text.map((style) => (
            <li key={style.id} className="space-y-1 rounded border border-border p-2">
              <Input className="h-7" value={style.name} onChange={(e) => patchLibrary(updateTextStyleInLibrary(library, style.id, { name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-1">
                <Input type="number" className="h-7" value={style.fontSize} onChange={(e) => patchLibrary(updateTextStyleInLibrary(library, style.id, { fontSize: Number(e.target.value) }))} />
                <Input className="h-7" value={String(style.fontWeight)} onChange={(e) => patchLibrary(updateTextStyleInLibrary(library, style.id, { fontWeight: e.target.value }))} />
              </div>
              <Button type="button" size="sm" variant="ghost" className="h-7" disabled={!one} onClick={() => onApplyTextStyle(style.id)}>
                {t("protoStyleApply")}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
