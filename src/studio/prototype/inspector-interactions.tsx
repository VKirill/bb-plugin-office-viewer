import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "../../shared/i18n";
import {
  emptyInteraction,
  INTERACTION_ACTION_TYPES,
  INTERACTION_EVENTS,
  interactionPresetsForType,
  newCaseId,
  newInteractionId,
  type Interaction,
  type InteractionAction,
  type InteractionActionType,
  type InteractionEvent,
} from "./interactions";
import type { WireframeElement, WireframePage } from "./model";

export function InspectorInteractionsPanel({
  inspect,
  pages,
  elements,
  onChange,
}: {
  inspect: WireframeElement;
  pages: readonly WireframePage[];
  elements: readonly WireframeElement[];
  onChange: (interactions: Interaction[]) => void;
}) {
  const t = useT();
  const interactions = inspect.interactions ?? [];
  const presets = interactionPresetsForType(inspect.type);

  const update = (next: Interaction[]) => onChange(next);

  const addInteraction = (event: InteractionEvent = "click") => update([...interactions, emptyInteraction(event)]);

  const addPreset = (preset: ReturnType<typeof interactionPresetsForType>[number]) => {
    const actions = preset.actions.map((action) => {
      const copy = { ...action };
      if (copy.targetId === "") copy.targetId = inspect.id;
      if (copy.type === "setPanelState" && !copy.targetId) copy.targetId = inspect.id;
      return copy;
    });
    update([
      ...interactions,
      { id: newInteractionId(), event: preset.event, cases: [{ id: newCaseId(), name: t(preset.labelKey), actions }] },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <Button key={preset.id} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addPreset(preset)}>
            {t(preset.labelKey)}
          </Button>
        ))}
      </div>
      <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => addInteraction("click")}>
        {t("protoIxAddEvent")}
      </Button>
      {interactions.length === 0 ? <p className="text-xs text-muted-foreground">{t("protoIxEmpty")}</p> : null}
      {interactions.map((interaction, ixIndex) => (
        <div key={interaction.id} className="space-y-2 rounded border border-border p-2">
          <div className="flex items-center gap-2">
            <select
              className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-xs"
              value={interaction.event}
              onChange={(event) => {
                const next = [...interactions];
                next[ixIndex] = { ...interaction, event: event.target.value as InteractionEvent };
                update(next);
              }}
            >
              {INTERACTION_EVENTS.map((event) => (
                <option key={event} value={event}>{t(`protoIxEvent_${event}`)}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => update(interactions.filter((item) => item.id !== interaction.id))}
            >
              {t("protoCtxDelete")}
            </Button>
          </div>
          {(interaction.cases[0] ?? { id: newCaseId(), actions: [] }).actions.map((action, actionIndex) => (
            <ActionEditor
              key={`${interaction.id}-${actionIndex}`}
              action={action}
              pages={pages}
              elements={elements}
              selfId={inspect.id}
              onChange={(nextAction) => {
                const cases = interaction.cases.length ? [...interaction.cases] : [{ id: newCaseId(), actions: [] }];
                const case0 = { ...cases[0]!, actions: [...cases[0]!.actions] };
                case0.actions[actionIndex] = nextAction;
                cases[0] = case0;
                const next = [...interactions];
                next[ixIndex] = { ...interaction, cases };
                update(next);
              }}
              onRemove={() => {
                const cases = [...interaction.cases];
                const case0 = { ...cases[0]!, actions: cases[0]!.actions.filter((_, i) => i !== actionIndex) };
                cases[0] = case0;
                const next = [...interactions];
                next[ixIndex] = { ...interaction, cases };
                update(next);
              }}
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-full text-xs"
            onClick={() => {
              const cases = interaction.cases.length ? [...interaction.cases] : [{ id: newCaseId(), actions: [] }];
              const case0 = { ...cases[0]!, actions: [...cases[0]!.actions, { type: "show" as const, targetId: "" }] };
              cases[0] = case0;
              const next = [...interactions];
              next[ixIndex] = { ...interaction, cases };
              update(next);
            }}
          >
            {t("protoIxAddAction")}
          </Button>
        </div>
      ))}
    </div>
  );
}

function ActionEditor({
  action,
  pages,
  elements,
  selfId,
  onChange,
  onRemove,
}: {
  action: InteractionAction;
  pages: readonly WireframePage[];
  elements: readonly WireframeElement[];
  selfId: string;
  onChange: (action: InteractionAction) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const needsTarget = ["show", "hide", "toggle", "setPanelState", "setText", "setSelected", "scrollTo"].includes(action.type);
  const targets = elements.filter((el) => el.id !== selfId || action.type === "setPanelState" || action.type === "setText");

  return (
    <div className="grid gap-1 rounded bg-muted/40 p-2">
      <div className="flex gap-1">
        <select
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
          value={action.type}
          onChange={(event) => onChange({ type: event.target.value as InteractionActionType })}
        >
          {INTERACTION_ACTION_TYPES.map((type) => (
            <option key={type} value={type}>{t(`protoIxAction_${type}`)}</option>
          ))}
        </select>
        <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 px-2" onClick={onRemove}>×</Button>
      </div>
      {action.type === "goToPage" ? (
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={action.pageId ?? ""}
          onChange={(event) => onChange({ ...action, pageId: event.target.value })}
        >
          <option value="">{t("protoIxPickPage")}</option>
          {pages.map((page) => (
            <option key={page.id} value={page.id}>{page.name}</option>
          ))}
        </select>
      ) : null}
      {action.type === "openLink" ? (
        <>
          <Input className="h-8 text-xs" value={action.url ?? ""} placeholder={t("protoIxLinkUrlPlaceholder")} onChange={(event) => onChange({ ...action, url: event.target.value })} />
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={action.target ?? "_blank"}
            onChange={(event) => onChange({ ...action, target: event.target.value as "_blank" | "_self" })}
          >
            <option value="_blank">{t("protoIxTargetBlank")}</option>
            <option value="_self">{t("protoIxTargetSelf")}</option>
          </select>
        </>
      ) : null}
      {needsTarget ? (
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={action.targetId ?? selfId}
          onChange={(event) => onChange({ ...action, targetId: event.target.value })}
        >
          {targets.map((el) => (
            <option key={el.id} value={el.id}>{el.label}</option>
          ))}
        </select>
      ) : null}
      {action.type === "setPanelState" ? (
        <Input className="h-8 text-xs" value={action.state ?? ""} placeholder={t("protoIxPanelState")} onChange={(event) => onChange({ ...action, state: event.target.value })} />
      ) : null}
      {action.type === "setText" ? (
        <Input className="h-8 text-xs" value={action.text ?? ""} onChange={(event) => onChange({ ...action, text: event.target.value })} />
      ) : null}
      {action.type === "setSelected" ? (
        <Input className="h-8 text-xs" value={action.value ?? ""} onChange={(event) => onChange({ ...action, value: event.target.value })} />
      ) : null}
      {action.type === "wait" ? (
        <Input
          type="number"
          className="h-8 text-xs"
          value={action.ms ?? 0}
          min={0}
          onChange={(event) => onChange({ ...action, ms: Number(event.target.value) })}
        />
      ) : null}
    </div>
  );
}
