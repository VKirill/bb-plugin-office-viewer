import { ElementFace } from "./elements";
import type { WireframeElement } from "./model";
import {
  activePanelState,
  childrenOf,
  expandRepeaterRow,
  panelStates,
  panelViewAllStates,
  repeaterColumns,
  repeaterData,
  type EditScope,
} from "./containers";

export function NestedContent({
  host,
  elements,
  editScope = null,
  depth = 0,
}: {
  host: WireframeElement;
  elements: readonly WireframeElement[];
  editScope?: EditScope | null;
  depth?: number;
}) {
  if (host.type === "DynamicPanel") {
    const states = panelStates(host);
    const active = editScope?.kind === "panel" && editScope.panelId === host.id ? editScope.state : activePanelState(host);
    const viewAll = panelViewAllStates(host) && editScope?.kind !== "panel";
    const layers = viewAll ? states : [active];
    return (
      <div className="relative size-full">
        {layers.map((state) => {
          const kids = childrenOf(elements, host.id, state);
          const ghost = viewAll && state !== active;
          return (
            <div key={state} className={ghost ? "pointer-events-none absolute inset-0 opacity-40" : "absolute inset-0"}>
              {ghost ? <div className="absolute left-1 top-1 text-[9px] text-muted-foreground">{state}</div> : null}
              {kids.map((child) => (
                <div key={child.id} className="absolute" style={{ left: child.x, top: child.y, width: child.w, height: child.h }}>
                  <NestedHost el={child} elements={elements} editScope={editScope} depth={depth + 1} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }
  if (host.type === "Repeater") {
    const template = childrenOf(elements, host.id);
    const data = repeaterData(host);
    const layout = typeof host.props.layout === "string" ? host.props.layout : "table";
    if (layout === "cards") {
      return (
        <div className="grid size-full grid-cols-2 gap-1 overflow-hidden p-1">
          {data.map((row, index) => {
            const rowEls = expandRepeaterRow(host, template, index, row);
            return (
              <div key={index} className="relative min-h-12 rounded border border-border bg-card">
                {rowEls.map((child) => (
                  <div key={child.id} className="absolute" style={{ left: child.x, top: child.y, width: child.w, height: child.h }}>
                    <ElementFace el={child} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );
    }
    const columns = repeaterColumns(host);
    return (
      <div className="size-full overflow-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} className="border border-border bg-muted px-1 py-0.5 text-left font-medium">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const rowEls = expandRepeaterRow(host, template, index, row);
              return (
                <tr key={index}>
                  <td className="relative border border-border p-0" colSpan={99}>
                    <div className="relative min-h-8" style={{ height: Math.max(32, ...rowEls.map((el) => el.y + el.h)) }}>
                      {rowEls.map((child) => (
                        <div key={child.id} className="absolute" style={{ left: child.x, top: child.y, width: child.w, height: child.h }}>
                          <ElementFace el={child} />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  const kids = childrenOf(elements, host.id);
  return (
    <div className="relative size-full">
      {kids.map((child) => (
        <div key={child.id} className="absolute" style={{ left: child.x, top: child.y, width: child.w, height: child.h }}>
          <NestedHost el={child} elements={elements} editScope={editScope} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

function NestedHost({
  el,
  elements,
  editScope,
  depth,
}: {
  el: WireframeElement;
  elements: readonly WireframeElement[];
  editScope: EditScope | null;
  depth: number;
}) {
  if (el.type === "Container" || el.type === "DynamicPanel" || el.type === "Repeater") {
    return (
      <div className="size-full overflow-hidden border border-border/40 bg-background/80">
        <NestedContent host={el} elements={elements} editScope={editScope} depth={depth} />
      </div>
    );
  }
  return <ElementFace el={el} />;
}
