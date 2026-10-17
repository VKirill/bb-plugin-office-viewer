import { studioT, type I18nKey } from "../../shared/i18n.ts";
import {
  type DeckTheme,
  type Slide,
  type SlideLayout,
  LAYOUT_IDS,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  headingElement,
  imagePlaceholder,
  newSlide,
  textElement,
  themeCanvas,
} from "./model.ts";
import type { WireframeElement } from "../prototype/model.ts";

export { LAYOUT_IDS };

export const LAYOUT_LABEL: Record<SlideLayout, I18nKey> = {
  title: "slidesLayoutTitle",
  "title-body": "slidesLayoutTitleBody",
  "two-column": "slidesLayoutTwoColumn",
  "image-caption": "slidesLayoutImageCaption",
  blank: "slidesLayoutBlank",
};

export function layoutElements(layout: SlideLayout, theme: DeckTheme): WireframeElement[] {
  const pad = 80;
  const innerW = SLIDE_WIDTH - pad * 2;
  const existing: WireframeElement[] = [];

  if (layout === "blank") return [];

  if (layout === "title") {
    return [
      headingElement(studioT("slidesDefTitle"), pad, SLIDE_HEIGHT * 0.35, innerW, 96, existing),
      textElement(studioT("slidesDefSubtitle"), pad, SLIDE_HEIGHT * 0.35 + 112, innerW, 48, existing),
    ];
  }

  if (layout === "title-body") {
    return [
      headingElement(studioT("slidesDefHeading"), pad, pad, innerW, 72, existing),
      textElement(studioT("slidesDefBody"), pad, pad + 96, innerW, SLIDE_HEIGHT - pad * 2 - 96, existing),
    ];
  }

  if (layout === "two-column") {
    const colW = (innerW - 32) / 2;
    return [
      headingElement(studioT("slidesDefTwoColumns"), pad, pad, innerW, 56, existing),
      textElement(studioT("slidesDefLeftColumn"), pad, pad + 80, colW, SLIDE_HEIGHT - pad - 80, existing),
      textElement(studioT("slidesDefRightColumn"), pad + colW + 32, pad + 80, colW, SLIDE_HEIGHT - pad - 80, existing),
    ];
  }

  if (layout === "image-caption") {
    const imgH = Math.round(SLIDE_HEIGHT * 0.55);
    return [
      imagePlaceholder(pad, pad, innerW, imgH, existing),
      textElement(studioT("slidesDefCaption"), pad, pad + imgH + 24, innerW, 64, existing),
    ];
  }

  return [];
}

export function slideFromLayout(layout: SlideLayout, theme: DeckTheme, name?: string): Slide {
  const slide = newSlide(layout, theme, name);
  return { ...slide, canvas: themeCanvas(theme), elements: layoutElements(layout, theme) };
}
