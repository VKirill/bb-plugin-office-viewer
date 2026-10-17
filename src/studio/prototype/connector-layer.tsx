import type { WireframeElement } from "./model";
import {
  anchorPoint,
  connectorPathPoints,
  connectorStroke,
  isConnector,
  labelPosition,
  pathToSvgD,
  readConnectorProps,
  shapeElements,
  type ConnectorAnchor,
  type Point,
} from "./connectors";

export function ConnectorsLayer({
  elements,
  selected,
  connectorTool,
  hoverElementId,
  draftLine,
}: {
  elements: WireframeElement[];
  selected: string[];
  connectorTool: boolean;
  hoverElementId: string | null;
  draftLine: { from: Point; to: Point } | null;
}) {
  const connectors = elements.filter((el) => isConnector(el) && !el.hidden);
  const shapes = shapeElements(elements);
  const hover = hoverElementId ? shapes.find((el) => el.id === hoverElementId) : null;

  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <defs>
        <marker id="proto-conn-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
        </marker>
        <marker id="proto-conn-dot" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <circle cx="3" cy="3" r="2.5" fill="context-stroke" />
        </marker>
      </defs>
      {connectors.map((el) => {
        const props = readConnectorProps(el);
        const points = connectorPathPoints(el, elements);
        const { color, width } = connectorStroke(el);
        const d = pathToSvgD(points, props.routing);
        const active = selected.includes(el.id);
        const startMarker = markerId(props.startArrow);
        const endMarker = markerId(props.endArrow);
        const label = props.label.trim();
        const labelAt = labelPosition(points);
        return (
          <g key={el.id} data-connector={el.id} className="pointer-events-auto">
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={width}
              strokeDasharray={props.dashed ? "6 4" : undefined}
              markerStart={startMarker}
              markerEnd={endMarker}
              opacity={el.style?.base?.opacity ?? 1}
              className={active ? "opacity-100" : undefined}
            />
            <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(12, width + 8)} data-connector-hit={el.id} />
            {label ? (
              <g transform={`translate(${labelAt.x}, ${labelAt.y})`}>
                <rect x={-label.length * 3.2 - 6} y={-9} width={label.length * 6.4 + 12} height={18} rx={3} fill="var(--background)" stroke="var(--border)" />
                <text textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={color}>{label}</text>
              </g>
            ) : null}
          </g>
        );
      })}
      {draftLine ? (
        <line
          x1={draftLine.from.x}
          y1={draftLine.from.y}
          x2={draftLine.to.x}
          y2={draftLine.to.y}
          stroke="var(--primary)"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
      ) : null}
      {connectorTool && hover ? (
        <g>
          {(["top", "right", "bottom", "left"] as ConnectorAnchor[]).map((anchor) => {
            const p = anchorPoint(hover, anchor);
            return <circle key={anchor} cx={p.x} cy={p.y} r={4} fill="var(--primary)" stroke="var(--background)" strokeWidth={1.5} data-anchor={anchor} data-anchor-el={hover.id} className="pointer-events-auto" />;
          })}
        </g>
      ) : null}
    </svg>
  );
}

function markerId(head: string): string | undefined {
  if (head === "arrow") return "url(#proto-conn-arrow)";
  if (head === "dot") return "url(#proto-conn-dot)";
  return undefined;
}

export function connectorHandlePoints(el: WireframeElement, elements: WireframeElement[]): { start: Point; end: Point; bend: Point | null } {
  const props = readConnectorProps(el);
  const points = connectorPathPoints(el, elements);
  const start = points[0] ?? { x: 0, y: 0 };
  const end = points[points.length - 1] ?? start;
  const bend = props.bendX !== 0 || props.bendY !== 0 ? { x: props.bendX, y: props.bendY } : props.routing === "elbow" && points.length > 2 ? points[Math.floor(points.length / 2)]! : null;
  return { start, end, bend };
}
