import type { MouseEvent } from "react";

import type { LayoutPoint } from "../../core/layout/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "../../entities/actor/actorVisuals";
import type { RootState } from "../../store/store";
import type { ActorDragState } from "./canvasInteractionTypes";
import { getActorRenderPlacements } from "./actorCanvasLayout";
import { CANVAS_BACKGROUND_COLOR } from "./canvasConstants";
import { getReadableTextColor } from "./canvasLuminance";

type ActorLayerProps = {
  actorDrag: ActorDragState | null;
  showFactionOutlines: boolean;
  encounter: RootState["encounter"]["present"];
  onActorMouseDown: (
    actorId: string,
    point: LayoutPoint,
    event: MouseEvent<SVGGElement>
  ) => void;
  onActorMouseEnter: (actorId: string) => void;
  onActorMouseLeave: (actorId: string) => void;
  selection: RootState["interaction"]["selection"];
};

function getDraggedPoint(
  actorId: string,
  point: LayoutPoint,
  actorDrag: ActorDragState | null
): LayoutPoint {
  if (!actorDrag?.actorIds.includes(actorId)) {
    return point;
  }

  return {
    x: point.x + actorDrag.current.x - actorDrag.start.x,
    y: point.y + actorDrag.current.y - actorDrag.start.y
  };
}

export function ActorLayer({
  actorDrag,
  showFactionOutlines,
  encounter,
  onActorMouseDown,
  onActorMouseEnter,
  onActorMouseLeave,
  selection
}: ActorLayerProps) {
  return getActorRenderPlacements(encounter).map(({ actor, point, radius }) => {
    const renderedPoint = getDraggedPoint(actor.id, point, actorDrag);
    const selected =
      selection.selectedEntityType === "actor" &&
      selection.selectedIds.includes(actor.id);
    const colors = ACTOR_LAYOUT_GROUP_COLORS[actor.layoutGroup];
    const zoneFill = encounter.zones.byId[actor.currentZoneId]?.colorFill;
    const selectedActorTextColor = getReadableTextColor(
      zoneFill ?? CANVAS_BACKGROUND_COLOR
    );
    const clipId = `${actor.id}-clip`;
    const innerRadius = Math.max(radius - 3, 1);

    return (
      <g
        key={actor.id}
        aria-label={actor.name}
        className="cursor-grab active:cursor-grabbing"
        data-entity-id={actor.id}
        data-entity-type="actor"
        onMouseDown={(event) => onActorMouseDown(actor.id, renderedPoint, event)}
        onMouseEnter={() => onActorMouseEnter(actor.id)}
        onMouseLeave={() => onActorMouseLeave(actor.id)}
        transform={`translate(${renderedPoint.x} ${renderedPoint.y})`}
      >
        {actor.shape === "rectangle" ? (
          <rect
            className="stroke-white"
            fill={colors.fill}
            height={radius * 2}
            rx="6"
            strokeWidth={selected ? 4 : 2}
            width={radius * 2}
            x={-radius}
            y={-radius}
          />
        ) : (
          <circle
            className="stroke-white"
            fill={colors.fill}
            r={radius}
            strokeWidth={selected ? 4 : 2}
          />
        )}
        {actor.image ? (
          <>
            <clipPath id={clipId}>
              {actor.shape === "rectangle" ? (
                <rect
                  height={innerRadius * 2}
                  rx="4"
                  width={innerRadius * 2}
                  x={-innerRadius}
                  y={-innerRadius}
                />
              ) : (
                <circle r={innerRadius} />
              )}
            </clipPath>
            <image
              clipPath={`url(#${clipId})`}
              height={innerRadius * 2}
              href={actor.image}
              preserveAspectRatio="xMidYMid slice"
              width={innerRadius * 2}
              x={-innerRadius}
              y={-innerRadius}
            />
          </>
        ) : (
          <text
            className="pointer-events-none text-[10px] font-bold"
            dominantBaseline="middle"
            fill={getReadableTextColor(colors.fill)}
            textAnchor="middle"
          >
            {actor.name.toUpperCase()}
          </text>
        )}
        {selected ? (
          actor.shape === "rectangle" ? (
            <rect
              className="pointer-events-none fill-none stroke-canvas-ink"
              height={(radius + 5) * 2}
              rx="8"
              strokeDasharray="5 5"
              strokeWidth="2"
              width={(radius + 5) * 2}
              x={-(radius + 5)}
              y={-(radius + 5)}
            />
          ) : (
            <circle
              className="pointer-events-none fill-none stroke-canvas-ink"
              r={radius + 5}
              strokeDasharray="5 5"
              strokeWidth="2"
            />
          )
        ) : null}
        {showFactionOutlines ? (
          actor.shape === "rectangle" ? (
            <rect
              className="pointer-events-none fill-none"
              height={(radius + 9) * 2}
              rx="10"
              stroke={colors.outline}
              strokeWidth="4"
              width={(radius + 9) * 2}
              x={-(radius + 9)}
              y={-(radius + 9)}
            />
          ) : (
            <circle
              className="pointer-events-none fill-none"
              r={radius + 9}
              stroke={colors.outline}
              strokeWidth="4"
            />
          )
        ) : null}
        {selected ? (
          <text
            className="pointer-events-none text-[10px] font-bold"
            dominantBaseline="middle"
            fill={selectedActorTextColor}
            textAnchor="middle"
            dy={radius + 16}
          >
            {actor.name.toUpperCase()}
          </text>
        ) : null}
      </g>
    );
  });
}
