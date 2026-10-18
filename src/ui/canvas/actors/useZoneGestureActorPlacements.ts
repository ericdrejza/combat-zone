import { useRef } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { VertexDragState, ZoneDragState } from '@ui/canvas/canvasInteractionTypes';
import type { ActorRenderPlacement } from './actorCanvasLayout';
import { rebaseZoneActorPlacements } from './rebaseZoneActorPlacements';

type Snapshot = {
  active: boolean;
  encounterId: string;
  key: string;
  zoneId: string;
  polygon: LayoutPoint[];
  placements: ActorRenderPlacement[];
};

/** Worker packing cannot replace the geometry underlying an active gesture. */
export function useZoneGestureActorPlacements(encounter: EncounterState, placements: ActorRenderPlacement[], zoneDrag: ZoneDragState | null, vertexDrag: VertexDragState | null) {
  const snapshot = useRef<Snapshot>();
  const gesture = vertexDrag ?? zoneDrag;
  const zone = gesture && encounter.zones.byId[gesture.zoneId];
  if (!encounter.movementRules.zoneLocked || !gesture || !zone) {
    if (snapshot.current) snapshot.current.active = false;
    return placements;
  }
  const key = `${vertexDrag ? 'resize' : 'move'}:${gesture.zoneId}:${gesture.gestureId}`;
  if (!snapshot.current?.active || snapshot.current.key !== key || snapshot.current.encounterId !== encounter.id) {
    const previous = snapshot.current;
    const origins = previous?.active && previous.encounterId === encounter.id && previous.zoneId === zone.id
      ? rebaseZoneActorPlacements(previous.placements, zone.id, previous.polygon, zone.polygon) : placements.filter(({ actor }) => actor.currentZoneId === zone.id);
    snapshot.current = { active: true, encounterId: encounter.id, key, zoneId: zone.id, polygon: zone.polygon, placements: origins };
  }
  const frozen = new Map(rebaseZoneActorPlacements(snapshot.current.placements, zone.id, snapshot.current.polygon, zone.polygon).map(placement => [placement.actor.id, placement]));
  return placements.map(placement => {
    const origin = frozen.get(placement.actor.id);
    return origin && placement.actor.currentZoneId === zone.id
      ? { ...origin, actor: placement.actor, incomingPoint: placement.incomingPoint } : placement;
  });
}
