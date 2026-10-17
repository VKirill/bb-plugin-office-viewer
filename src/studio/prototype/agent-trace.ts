import { defaultElement, getActivePage, updateActivePage, type Wireframe, type WireframeElement } from "./model.ts";
import { studioT } from "../../shared/i18n.ts";

export const AGENT_TRACE_PROP = "agentTrace";

export function isAgentTraceElement(el: WireframeElement): boolean {
  return el.props[AGENT_TRACE_PROP] === true;
}

/** Locked full-canvas reference image for screenshot tracing (30% opacity). */
export function upsertAgentTraceLayer(doc: Wireframe, src: string): Wireframe {
  const page = getActivePage(doc);
  const without = page.elements.filter((el) => !isAgentTraceElement(el));
  const trace = defaultElement("Image", 0, 0, without);
  trace.label = studioT("protoAgentTraceLayer");
  trace.w = page.canvas.width;
  trace.h = page.canvas.height;
  trace.locked = true;
  trace.props = { ...trace.props, alt: "Reference", src, [AGENT_TRACE_PROP]: true };
  trace.style = { base: { opacity: 0.3 } };
  return updateActivePage(doc, (p) => ({ ...p, elements: [trace, ...without] }));
}
