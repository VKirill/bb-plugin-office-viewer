// Prototype interactions: event → case → action runtime for preview.
import { z } from "zod";
import type { I18nKey } from "../../shared/i18n.ts";
import { simpleEditKey } from "./editing.ts";
import type { ElementType, PropValue, Wireframe, WireframeElement, WireframePage } from "./model.ts";

export const INTERACTION_EVENTS = ["click", "doubleClick", "mouseEnter", "mouseLeave"] as const;
export type InteractionEvent = (typeof INTERACTION_EVENTS)[number];

export const INTERACTION_ACTION_TYPES = [
  "openLink",
  "goToPage",
  "show",
  "hide",
  "toggle",
  "setPanelState",
  "setText",
  "setSelected",
  "scrollTo",
  "wait",
] as const;
export type InteractionActionType = (typeof INTERACTION_ACTION_TYPES)[number];

export type InteractionAction = {
  type: InteractionActionType;
  url?: string;
  target?: "_blank" | "_self";
  pageId?: string;
  targetId?: string;
  state?: string;
  text?: string;
  value?: string;
  propKey?: string;
  ms?: number;
};

export type InteractionCase = {
  id: string;
  name?: string;
  actions: InteractionAction[];
};

export type Interaction = {
  id: string;
  event: InteractionEvent;
  cases: InteractionCase[];
};

const actionSchema = z
  .object({
    type: z.enum(INTERACTION_ACTION_TYPES),
    url: z.string().optional(),
    target: z.enum(["_blank", "_self"]).optional(),
    pageId: z.string().optional(),
    targetId: z.string().optional(),
    state: z.string().optional(),
    text: z.string().optional(),
    value: z.string().optional(),
    propKey: z.string().optional(),
    ms: z.number().finite().nonnegative().optional(),
  })
  .strict();

const caseSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().max(200).optional(),
    actions: z.array(actionSchema).max(50),
  })
  .strict();

export const interactionSchema = z
  .object({
    id: z.string().min(1).max(128),
    event: z.enum(INTERACTION_EVENTS),
    cases: z.array(caseSchema).max(20),
  })
  .strict();

export const interactionsSchema = z.array(interactionSchema).max(40);

export type RuntimeElementPatch = {
  hidden?: boolean;
  props?: Record<string, PropValue>;
};

export type PreviewState = {
  pageId: string;
  patches: Record<string, RuntimeElementPatch>;
  scrollToId?: string | null;
};

export type PendingEffect =
  | { type: "openLink"; url: string; target?: "_blank" | "_self" }
  | { type: "wait"; ms: number };

let nextInteractionId = 0;
let nextCaseId = 0;

export function newInteractionId(): string {
  return `int_${Date.now().toString(36)}_${(++nextInteractionId).toString(36)}`;
}

export function newCaseId(): string {
  return `icc_${Date.now().toString(36)}_${(++nextCaseId).toString(36)}`;
}

export function parseInteractions(raw: unknown): Interaction[] {
  if (!raw) return [];
  return interactionsSchema.parse(raw);
}

export function elementHasInteractions(el: WireframeElement): boolean {
  return Boolean(el.interactions?.some((item) => item.cases.some((caseItem) => caseItem.actions.length > 0)));
}

export function actionsForEvent(el: WireframeElement, event: InteractionEvent): InteractionAction[] {
  const hit = (el.interactions ?? []).find((item) => item.event === event);
  if (!hit?.cases.length) return [];
  return hit.cases[0]!.actions;
}

export function isVisibleInPreview(el: WireframeElement, state: PreviewState): boolean {
  const patch = state.patches[el.id];
  const hidden = patch?.hidden ?? el.hidden ?? false;
  return !hidden;
}

export function resolveElement(el: WireframeElement, state: PreviewState): WireframeElement {
  const patch = state.patches[el.id];
  if (!patch) return el;
  return {
    ...el,
    hidden: patch.hidden ?? el.hidden,
    props: patch.props ? { ...el.props, ...patch.props } : el.props,
  };
}

export function materializePage(page: WireframePage, state: PreviewState): WireframeElement[] {
  return page.elements.map((el) => resolveElement(el, state)).filter((el) => !el.hidden);
}

export function initialPreviewState(doc: Wireframe, pageId?: string): PreviewState {
  const page = doc.pages.find((item) => item.id === pageId) ?? doc.pages[0]!;
  return { pageId: page.id, patches: {}, scrollToId: null };
}

function patchElement(state: PreviewState, elementId: string, patch: RuntimeElementPatch): PreviewState {
  const prev = state.patches[elementId] ?? {};
  return {
    ...state,
    patches: {
      ...state.patches,
      [elementId]: {
        hidden: patch.hidden ?? prev.hidden,
        props: patch.props ? { ...(prev.props ?? {}), ...patch.props } : prev.props,
      },
    },
  };
}

function findElement(doc: Wireframe, pageId: string, elementId: string): WireframeElement | null {
  const page = doc.pages.find((item) => item.id === pageId);
  return page?.elements.find((el) => el.id === elementId) ?? null;
}

export function applyAction(doc: Wireframe, state: PreviewState, action: InteractionAction): { state: PreviewState; effects: PendingEffect[] } {
  const effects: PendingEffect[] = [];
  let next = state;

  switch (action.type) {
    case "openLink": {
      const url = action.url ?? "";
      if (url) effects.push({ type: "openLink", url, target: action.target });
      break;
    }
    case "goToPage": {
      const pageId = action.pageId;
      if (pageId && doc.pages.some((page) => page.id === pageId)) {
        next = { ...next, pageId, scrollToId: null };
      }
      break;
    }
    case "show": {
      if (action.targetId) next = patchElement(next, action.targetId, { hidden: false });
      break;
    }
    case "hide": {
      if (action.targetId) next = patchElement(next, action.targetId, { hidden: true });
      break;
    }
    case "toggle": {
      if (!action.targetId) break;
      const base = findElement(doc, next.pageId, action.targetId);
      const resolved = base ? resolveElement(base, next) : null;
      const hidden = resolved?.hidden === true;
      next = patchElement(next, action.targetId, { hidden: !hidden });
      break;
    }
    case "setPanelState": {
      if (action.targetId && action.state) {
        next = patchElement(next, action.targetId, { props: { active: action.state } });
      }
      break;
    }
    case "setText": {
      if (action.targetId) {
        const target = findElement(doc, next.pageId, action.targetId);
        const key = target ? simpleEditKey(target.type) ?? "text" : "text";
        next = patchElement(next, action.targetId, { props: { [key]: action.text ?? "" } });
      }
      break;
    }
    case "setSelected": {
      if (action.targetId) {
        const target = findElement(doc, next.pageId, action.targetId);
        const key = action.propKey ?? defaultSelectPropKey(target?.type);
        if (key) next = patchElement(next, action.targetId, { props: { [key]: action.value ?? "" } });
      }
      break;
    }
    case "scrollTo": {
      if (action.targetId) next = { ...next, scrollToId: action.targetId };
      break;
    }
    case "wait": {
      effects.push({ type: "wait", ms: Math.max(0, Math.round(action.ms ?? 0)) });
      break;
    }
  }

  return { state: next, effects };
}

function defaultSelectPropKey(type?: ElementType): string | null {
  if (!type) return "value";
  if (type === "Tabs") return "active";
  if (type === "ListBox") return "selected";
  if (type === "ChoicePicker") return "value";
  if (type === "Radio" || type === "Checkbox" || type === "Switch") return "checked";
  return "value";
}

export function applyActions(
  doc: Wireframe,
  state: PreviewState,
  actions: readonly InteractionAction[],
): { state: PreviewState; effects: PendingEffect[] } {
  let next = state;
  const effects: PendingEffect[] = [];
  for (const action of actions) {
    const result = applyAction(doc, next, action);
    next = result.state;
    effects.push(...result.effects);
  }
  return { state: next, effects };
}

export function dispatchInteraction(
  doc: Wireframe,
  state: PreviewState,
  element: WireframeElement,
  event: InteractionEvent,
): { state: PreviewState; effects: PendingEffect[] } {
  return applyActions(doc, state, actionsForEvent(element, event));
}

export async function runPendingEffects(effects: readonly PendingEffect[], waitFn: (ms: number) => Promise<void> = delay): Promise<void> {
  for (const effect of effects) {
    if (effect.type === "wait") await waitFn(effect.ms);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type InteractionPreset = {
  id: string;
  labelKey: I18nKey;
  event: InteractionEvent;
  actions: InteractionAction[];
};

export function interactionPresetsForType(type: ElementType): InteractionPreset[] {
  const presets: InteractionPreset[] = [];
  if (type === "Button" || type === "HotSpot") {
    presets.push({
      id: "nav-next",
      labelKey: "protoIxPresetGoToPage",
      event: "click",
      actions: [{ type: "goToPage", pageId: "" }],
    });
  }
  if (type === "DynamicPanel") {
    presets.push({
      id: "panel-state",
      labelKey: "protoIxPresetPanelState",
      event: "click",
      actions: [{ type: "setPanelState", targetId: "", state: "State 2" }],
    });
  }
  if (type === "Tabs" || type === "ListBox" || type === "ChoicePicker") {
    presets.push({
      id: "set-selected",
      labelKey: "protoIxPresetSetSelected",
      event: "click",
      actions: [{ type: "setSelected", targetId: "", value: "" }],
    });
  }
  if (type === "Text" || type === "Label" || type === "Heading" || type === "Button") {
    presets.push({
      id: "set-text",
      labelKey: "protoIxPresetSetText",
      event: "click",
      actions: [{ type: "setText", targetId: "", text: "" }],
    });
  }
  presets.push({
    id: "open-link",
    labelKey: "protoIxPresetOpenLink",
    event: "click",
    actions: [{ type: "openLink", url: "https://example.com", target: "_blank" }],
  });
  presets.push({
    id: "toggle-target",
    labelKey: "protoIxPresetToggle",
    event: "click",
    actions: [{ type: "toggle", targetId: "" }],
  });
  return presets;
}

export function emptyInteraction(event: InteractionEvent = "click"): Interaction {
  return { id: newInteractionId(), event, cases: [{ id: newCaseId(), actions: [] }] };
}
