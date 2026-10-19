import { engagementFootprintsAreSeparate } from '@core/layout/engagementFootprintGeometry';
import type { EncounterState } from '@core/encounter/types';
import { footprintFitsPolygon } from '@core/layout/engagementPackingCandidates';
import { getZoneLocalPolygon, rotatePoint } from '@entities/zone/zoneRotation';
import type { ActorPlacementGeometry } from './actorPlacementCache';

type Calculator = (encounter: EncounterState, zoneIds?: readonly string[]) => ActorPlacementGeometry[];

/** Recompute in the persisted editing frame so reloads retain rotated packing. */
export function calculateOrientedActorPlacements(encounter: EncounterState, zoneIds: readonly string[] | undefined, calculate: Calculator): ActorPlacementGeometry[] | undefined {
  const ids = zoneIds ?? encounter.zones.allIds;
  if (!ids.some(id => encounter.zones.byId[id]?.rotation)) return undefined;
  return ids.flatMap(id => {
    const zone = encounter.zones.byId[id];
    if (!zone?.rotation) return calculate(encounter, [id]);
    const local = { ...zone, rotation: 0, polygon: getZoneLocalPolygon(zone) };
    const source = { ...encounter, zones: { ...encounter.zones, byId: { ...encounter.zones.byId, [id]: local } } };
    const transform = (point: { x: number; y: number }) => rotatePoint(point, zone.rotation!);
    const placements = calculate(source, [id]).map(placement => ({
      ...placement, point: transform(placement.point),
      ...(placement.engagementTokenPoint ? { engagementTokenPoint: transform(placement.engagementTokenPoint) } : {}),
      ...(placement.sectionPolygon ? { sectionPolygon: placement.sectionPolygon.map(transform) } : {})
    }));
    const footprints = placements.map(placement => ({ ...placement, shape: encounter.actors.byId[placement.actorId].shape }));
    if (footprints.every((placement, i) => footprintFitsPolygon(placement.point, placement.radius, zone.polygon, 0, placement.shape) &&
      footprints.slice(i + 1).every(other => engagementFootprintsAreSeparate(placement, other, 0)))) return placements;
    // Upright rectangular artwork can need a different packing after rotation.
    return calculate({ ...source, zones: { ...source.zones, byId: { ...source.zones.byId, [id]: { ...zone, rotation: 0 } } } }, [id]);
  });
}
