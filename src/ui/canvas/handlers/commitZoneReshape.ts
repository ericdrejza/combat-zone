import { snapZonePolygon } from "@core/movement/zoneVertexSnapping";
import { consumeEncounterPreparation, runEncounterOperation } from "@core/history/encounterOperations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/runtimeEncounterChange";
import type { EncounterState } from "@core/encounter/types";
import { selectEntity } from "@interaction/interactionState";
import { updateZonePolygon } from "@entities/zone/zoneMutations";
import { commitEncounterChange } from "@store/encounterSlice";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { logEncounterValidationBlock, logEncounterValidationFailure } from "@store/encounterLogSlice";
import { canCommitZonePolygon, getZoneResizeAnchor, getZoneResizeHandles } from "@ui/canvas/zones/zoneGeometry";
import type { PendingZoneReshape } from "@ui/canvas/canvasInteractionTypes";
import type { MouseUpHandlerInput } from "./mouseUpTypes";
import { retainResizeActorPreview } from "@ui/canvas/actors/retainResizeActorPreview";
import { resolveActorPlacements } from "@ui/canvas/actors/resolveActorPlacements";

const INVALID = "A zone must remain within the canvas and must not overlap another zone.";

/** Released resizes retain their validation/history position when a new gesture starts. */
export function commitZoneReshape(input: MouseUpHandlerInput): boolean {
  const { encounter, vertexDrag } = input;
  if (!vertexDrag || vertexDrag.phase === "validating") return false;
  const revision = input.zoneGestureRevisionRef.current;
  const zone = encounter.zones.byId[vertexDrag.zoneId];
  const ownsGesture = () => input.zoneGestureRevisionRef.current === revision;
  const clear = () => { if (ownsGesture()) input.setVertexDrag(null); };
  input.suppressNextCanvasClickRef.current = true;
  input.suppressNextCanvasClickUnconditionallyRef.current = true;
  input.suppressNextCanvasClickPointRef.current = zone ? getZoneResizeHandles(zone, vertexDrag.polygon)[vertexDrag.vertexIndex] : null;
  if (!vertexDrag.hasMoved) { clear(); return true; }
  if (!canCommitZonePolygon(vertexDrag.polygon, encounter.zones, vertexDrag.zoneId, encounter.canvasSize)) {
    logEncounterValidationFailure(input.dispatch, encounter, { actionType: "zone.reshape", code: "zone.invalidPolygonPlacement", message: INVALID,
      payload: { polygon: vertexDrag.polygon, zoneId: vertexDrag.zoneId } });
    clear(); return true;
  }
  const ref = input.pendingZoneReshapeRef ?? { current: null };
  const previous = ref.current?.encounterId === encounter.id ? ref.current : null;
  let resolve!: (state: EncounterState | null) => void;
  const pending: PendingZoneReshape = { encounterId: encounter.id, zoneId: vertexDrag.zoneId, polygon: zone ? snapZonePolygon(encounter, { ...zone, polygon: vertexDrag.polygon }) : vertexDrag.polygon,
    completion: new Promise(done => { resolve = done; }) };
  ref.current = pending;
  input.setVertexDrag({ ...vertexDrag, phase: "validating" });
  const finish = (state: EncounterState | null) => {
    if (ref.current === pending) ref.current = null;
    clear(); resolve(state);
  };
  const begin = (base: EncounterState | null) => input.dispatch((_dispatch, getState) => {
    if (!base || base.id !== encounter.id || getState().encounter.present !== base || !isPersistenceWritable()) { finish(null); return; }
    const currentZone = base.zones.byId[vertexDrag.zoneId];
    if (!currentZone) { finish(null); return; }
    const resizeAnchor = getZoneResizeAnchor(currentZone, vertexDrag.polygon, vertexDrag.vertexIndex);
    const prepared = prepareValidatedEncounterChangeForRuntime({ currentEncounter: base,
      nextEncounter: updateZonePolygon(base, vertexDrag.zoneId, vertexDrag.polygon),
      action: createEncounterActionRecord("zone.reshape", { polygon: vertexDrag.polygon, zoneId: vertexDrag.zoneId,
        ...(resizeAnchor ? { resizeAnchor } : {}) }) });
    void consumeEncounterPreparation(prepared, resolved => input.dispatch((_dispatch, latest) => {
      if (!isPersistenceWritable() || latest().encounter.present !== base) { finish(null); return; }
      const polygon = resolved.nextEncounter.zones.byId[vertexDrag.zoneId]?.polygon ?? vertexDrag.polygon;
      if (resolved.blocked || !canCommitZonePolygon(polygon, base.zones, vertexDrag.zoneId, base.canvasSize)) {
        if (!logEncounterValidationBlock(input.dispatch, resolved)) logEncounterValidationFailure(input.dispatch, base, {
          actionType: "zone.reshape", code: "zone.invalidPolygonPlacement", message: INVALID, payload: { polygon, zoneId: vertexDrag.zoneId }
        });
        finish(base); return;
      }
      if (base.movementRules.zoneLocked) {
        retainResizeActorPreview(input.actorRenderPlacements, currentZone.id, zone?.polygon ?? currentZone.polygon, pending.polygon);
      }
      input.dispatch(commitEncounterChange({ action: { ...resolved.action, payload: { ...resolved.action.payload,
        polygon, requestedPolygon: vertexDrag.polygon } }, nextEncounter: resolved.nextEncounter }));
      if (ownsGesture()) input.dispatch(selectEntity({ entityType: "zone", ids: [vertexDrag.zoneId] }));
      finish(latest().encounter.present);
    }), () => finish(null));
  });
  const start = (base: EncounterState | null) => {
    try {
      const placements = base ? resolveActorPlacements(base) : [];
      void consumeEncounterPreparation(placements, () => { begin(base); }, () => finish(null));
    } catch { finish(null); }
  };
  if (previous) void runEncounterOperation(() => previous.completion.then(start, () => finish(null)));
  // A worker may have committed since the event handler's last render.
  else input.dispatch((_dispatch, getState) => start(getState().encounter.present));
  return true;
}
