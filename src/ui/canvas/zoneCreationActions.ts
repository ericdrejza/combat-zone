import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import type { LayoutPoint } from "../../core/layout/types";
import type { ZoneShape } from "../../entities/zone/types";
import { createZone } from "../../entities/zone/zoneMutations";
import { selectEntity } from "../../interaction/interactionState";
import { commitEncounterChange } from "../../store/encounterSlice";
import type { CanvasInteractionState } from "./canvasInteractionTypes";
import { canCommitZonePolygon as canCommitZonePolygonForCollection } from "./zoneGeometry";
import { getCloneableZoneProperties } from "./zonePropertyTransfers";

type CommitZoneCreateInput = Pick<
  CanvasInteractionState,
  | "dispatch"
  | "encounter"
  | "lastZoneOpacity"
  | "setZoneDraftPoints"
  | "suppressNextCanvasClickPointRef"
  | "suppressNextCanvasClickRef"
>;

export function commitZoneCreate(
  input: CommitZoneCreateInput,
  polygon: LayoutPoint[],
  shape: ZoneShape,
  suppressClickPoint?: LayoutPoint,
  cloneSourceZoneId?: string
) {
  const {
    dispatch,
    encounter,
    lastZoneOpacity,
    setZoneDraftPoints,
    suppressNextCanvasClickPointRef,
    suppressNextCanvasClickRef
  } = input;

  if (!canCommitZonePolygonForCollection(polygon, encounter.zones)) {
    setZoneDraftPoints([]);
    return;
  }

  const zoneId = `zone-${Date.now()}`;
  const cloneSourceZone = cloneSourceZoneId
    ? encounter.zones.byId[cloneSourceZoneId]
    : undefined;
  const nextEncounter = createZone(encounter, {
    ...(cloneSourceZone ? getCloneableZoneProperties(cloneSourceZone) : {}),
    id: zoneId,
    name: `Zone ${encounter.zones.allIds.length + 1}`,
    opacity: cloneSourceZone ? cloneSourceZone.opacity : lastZoneOpacity,
    polygon,
    shape
  });

  dispatch(
    commitEncounterChange({
      action: createEncounterActionRecord("zone.create", {
        ...(cloneSourceZoneId ? { cloneSourceZoneId } : {}),
        zoneId,
        polygon,
        shape
      }),
      nextEncounter
    })
  );
  dispatch(
    selectEntity({
      entityType: "zone",
      ids: [zoneId]
    })
  );
  suppressNextCanvasClickRef.current = true;
  suppressNextCanvasClickPointRef.current =
    suppressClickPoint ?? polygon[polygon.length - 1] ?? null;
  setZoneDraftPoints([]);
}
