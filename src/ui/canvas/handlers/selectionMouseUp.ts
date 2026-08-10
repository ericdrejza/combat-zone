import { MIN_SHAPE_SIZE } from '../canvasConstants';
import { getActorRenderPlacements } from '../actors/actorCanvasLayout';
import { finishBoxSelection } from '@interaction/interactionState';
import { commitZoneCreate } from '../zones/zoneCreationActions';
import {
  createShapePolygon,
  distance,
  doBoundsOverlap,
  getBoxSelectionBounds,
  getPolygonBounds
} from '../zones/zoneGeometry';
import type { MouseUpHandlerInput } from './mouseUpTypes';

/** Finalize shape drafts and box selections, if either interaction is active. */
export function handleSelectionMouseUp(input: MouseUpHandlerInput): boolean {
  const { boxSelection, encounter, shapeDraft } = input;

  if (shapeDraft) {
    const polygon = createShapePolygon(
      shapeDraft.shape,
      shapeDraft.start,
      shapeDraft.current
    );
    if (distance(shapeDraft.start, shapeDraft.current) >= MIN_SHAPE_SIZE) {
      commitZoneCreate(
        input,
        polygon,
        shapeDraft.shape,
        shapeDraft.current,
        shapeDraft.cloneSourceZoneId
      );
    }
    input.setShapeDraft(null);
    return true;
  }

  if (!boxSelection) return false;

  const bounds = getBoxSelectionBounds(boxSelection);
  const isActorBoxSelection = input.activeToolId === 'actor';
  const selectedIds = isActorBoxSelection
    ? getActorRenderPlacements(encounter)
        .filter(({ point, radius }) =>
          doBoundsOverlap(bounds, {
            height: radius * 2,
            width: radius * 2,
            x: point.x - radius,
            y: point.y - radius
          })
        )
        .map(({ actor }) => actor.id)
    : encounter.zones.allIds.filter((zoneId) => {
        const zone = encounter.zones.byId[zoneId];
        return zone && doBoundsOverlap(bounds, getPolygonBounds(zone.polygon));
      });

  input.dispatch(
    finishBoxSelection({
      additive: true,
      entityType: isActorBoxSelection ? 'actor' : 'zone',
      ids: selectedIds
    })
  );
  input.setBoxSelection(null);
  input.suppressNextCanvasClickRef.current = true;
  input.suppressNextCanvasClickUnconditionallyRef.current = true;
  return true;
}
