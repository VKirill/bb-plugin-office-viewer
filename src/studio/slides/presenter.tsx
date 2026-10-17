import { useEffect, useState } from "react";
import { ConnectorsLayer } from "../prototype/connector-layer";
import { ElementFace } from "../prototype/elements";
import { isConnector } from "../prototype/connectors";
import { WireframeElementFrame } from "../prototype/wireframe-element-frame";
import type { SlidesDeck } from "./model";
import { getActiveSlide } from "./model";
import { useT } from "../../shared/i18n";
import { Button } from "@/components/ui/button";

export function SlidesPresenter({
  deck,
  startIndex,
  onClose,
}: {
  deck: SlidesDeck;
  startIndex: number;
  onClose: () => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(startIndex);
  const slide = deck.slides[index] ?? deck.slides[0]!;
  const total = deck.slides.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        setIndex((i) => Math.min(total - 1, i + 1));
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  const scale = Math.min(1, (window.innerWidth - 48) / slide.canvas.width, (window.innerHeight - 120) / slide.canvas.height);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
        <span className="text-sm text-white/80">{t("slidesPresenting", { current: index + 1, total })}</span>
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>{t("slidesEndPresent")}</Button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        <div
          className="relative shadow-2xl"
          style={{
            width: slide.canvas.width,
            height: slide.canvas.height,
            background: slide.canvas.background,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {slide.elements
            .filter((el) => !el.hidden && !isConnector(el))
            .map((el) => (
              <WireframeElementFrame key={el.id} el={el} className="absolute overflow-hidden">
                <ElementFace el={el} />
              </WireframeElementFrame>
            ))}
          <ConnectorsLayer elements={slide.elements} selected={[]} connectorTool={false} hoverElementId={null} draftLine={null} />
        </div>
      </div>
    </div>
  );
}

export function presentStartIndex(deck: SlidesDeck): number {
  const active = getActiveSlide(deck);
  const idx = deck.slides.findIndex((slide) => slide.id === active.id);
  return idx >= 0 ? idx : 0;
}
