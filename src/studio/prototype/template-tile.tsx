import { useMemo, useRef, type DragEvent } from "react";
import { ElementFace } from "./elements";
import type { PrototypeTemplate } from "./templates";
import { TEMPLATE_DRAG_PREFIX, previewElementsForTemplate, templatePreviewBounds } from "./templates";

export function TemplatePreview({ templateId }: { templateId: string }) {
  const elements = useMemo(() => previewElementsForTemplate(templateId), [templateId]);
  const bounds = useMemo(() => templatePreviewBounds(elements), [elements]);
  const scale = Math.min(40 / bounds.w, 40 / bounds.h, 1);
  return (
    <div className="relative mx-auto h-10 w-10 overflow-hidden rounded border border-border/60 bg-background">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: bounds.w, height: bounds.h, transform: `scale(${scale})` }}
      >
        {elements.map((el) => (
          <div key={el.id} className="absolute overflow-hidden" style={{ left: el.x, top: el.y, width: el.w, height: el.h }}>
            <ElementFace el={el} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TemplateTileButton({ template, label, onAdd }: { template: PrototypeTemplate; label: string; onAdd: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null);
  return (
    <button
      type="button"
      title={label}
      draggable
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData("text/plain", `${TEMPLATE_DRAG_PREFIX}${template.id}`);
        if (previewRef.current) event.dataTransfer.setDragImage(previewRef.current, 36, 28);
      }}
      onClick={onAdd}
      className="flex cursor-grab flex-col rounded-lg px-1 pb-1 pt-1 hover:bg-state-hover"
    >
      <div ref={previewRef} className="flex h-11 items-center justify-center">
        <TemplatePreview templateId={template.id} />
      </div>
      <span className="min-h-7 whitespace-normal text-balance text-center text-[10px] leading-3 text-muted-foreground">{label}</span>
    </button>
  );
}
