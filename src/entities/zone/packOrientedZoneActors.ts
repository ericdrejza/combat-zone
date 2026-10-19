import { packPolygonActors, type PolygonNestingInput, type PolygonNestingResult } from '@core/layout/nesting_ts';
import { footprintFitsPolygon } from '@core/layout/engagementPackingCandidates';
import { engagementFootprintsAreSeparate } from '@core/layout/engagementFootprintGeometry';
import { getZoneLocalPolygon, rotatePoint } from './zoneRotation';

/** Preserve local packing when upright footprints still fit in world coordinates. */
export function packOrientedZoneActors(input: PolygonNestingInput, rotation = 0): PolygonNestingResult {
  if (!rotation) return packPolygonActors(input);
  const local = packPolygonActors({ ...input, polygon: getZoneLocalPolygon({ polygon: input.polygon, rotation }) });
  if (!local.fits) return packPolygonActors(input);
  const placements = Object.fromEntries(Object.entries(local.placements).map(([id, point]) => [id, rotatePoint(point, rotation)]));
  const footprints = input.actors.map(actor => ({ ...actor, point: placements[actor.id] }));
  if (!footprints.every((actor, i) => actor.point && footprintFitsPolygon(actor.point, actor.radius, input.polygon, 0, actor.shape) &&
    footprints.slice(i + 1).every(other => other.point && engagementFootprintsAreSeparate(actor, other, 0)))) return packPolygonActors(input);
  return { ...local, placements, splitSections: local.splitSections?.map(section => ({ ...section, polygon: section.polygon.map(point => rotatePoint(point, rotation)) })) };
}
