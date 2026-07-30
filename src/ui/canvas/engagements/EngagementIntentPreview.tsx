import type { EncounterState } from '@core/encounter/types';
import type { ActorDragState } from '../canvasInteractionTypes';
import type { ActorRenderPlacement } from '../actors/actorCanvasLayout';
import crossedSwordsAsset from '@assets/images/crossed-swords.svg';

/** Renders above the dragged overlay actor once the hold-to-engage intent fires. */
export function EngagementIntentPreview({ actorDrag, encounter, placements }: {
  actorDrag: ActorDragState;
  encounter: EncounterState;
  placements: ActorRenderPlacement[];
}) {
  if (
    !actorDrag.engagementIntentActorId &&
    !actorDrag.engagementIntentEngagementId
  ) return null;
  const source = placements.find((placement) => placement.actor.id === actorDrag.actorId);
  const targetActor = actorDrag.engagementIntentActorId
    ? encounter.actors.byId[actorDrag.engagementIntentActorId]
    : undefined;
  const targetEngagement = actorDrag.engagementIntentEngagementId
    ? encounter.engagements.byId[actorDrag.engagementIntentEngagementId]
    : undefined;
  const zoneId = targetActor?.currentZoneId ?? targetEngagement?.parentZoneId;
  const zone = zoneId ? encounter.zones.byId[zoneId] : undefined;
  if (!source || !zone) return null;
  const point = { x: source.point.x + actorDrag.current.x - actorDrag.start.x, y: source.point.y + actorDrag.current.y - actorDrag.start.y };
  return <g aria-label="Engagement drop intent" transform={`translate(${point.x} ${point.y})`}>
    <circle fill="rgba(255,255,255,0.75)" r="12" stroke={zone.colorBorder} strokeWidth="2" />
    <image
      aria-label="Crossed swords"
      height="14"
      href={crossedSwordsAsset}
      width="14"
      x="-7"
      y="-7"
    />
  </g>;
}
