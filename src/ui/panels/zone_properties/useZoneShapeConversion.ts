import { useDispatch, useSelector } from "react-redux";
import { isSimplePolygon } from "@core/layout/polygonValidity";
import { isPolygonWithinCanvas } from "@core/layout/polygonCanvasBounds";
import { doPolygonsOverlap } from "@core/layout/polygonCollision";
import type { EncounterState } from "@core/encounter/types";
import { zoneSnappingValid } from "@core/movement/zoneVertexSnapping";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/runtimeEncounterChange";
import { convertZoneShape } from "@entities/zone/convertZoneShape";
import type { ZoneShape } from "@entities/zone/types";
import { consumeEncounterChange } from "@store/consumeEncounterChange";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock, logEncounterValidationFailure } from "@store/encounterLogSlice";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import type { RootState } from "@store/store";

/** Conversion follows reshape invariants before and after runtime reconciliation. */
export function useZoneShapeConversion() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  return (shape: ZoneShape) => {
    if (!isPersistenceWritable() || selection.selectedEntityType !== "zone") return;
    const zoneId = selection.selectedIds[0];
    const nextEncounter = convertZoneShape(encounter, zoneId, shape);
    if (nextEncounter === encounter) return;
    const valid = (state: EncounterState, checkSnapping = true) => {
      const zone = state.zones.byId[zoneId];
      return !!zone && isSimplePolygon(zone.polygon) && isPolygonWithinCanvas(zone.polygon, state.canvasSize) &&
        !state.zones.allIds.some(id => id !== zoneId && doPolygonsOverlap(zone.polygon, state.zones.byId[id].polygon)) &&
        (!checkSnapping || !state.movementRules.snapZoneVertices || zoneSnappingValid(state, zone));
    };
    const action = createEncounterActionRecord("zone.reshape", {
      zoneId, shape, polygon: nextEncounter.zones.byId[zoneId].polygon
    });
    const reject = () => logEncounterValidationFailure(dispatch, encounter, {
      actionType: action.type, code: "zone.invalidPolygonPlacement", payload: action.payload,
      message: "Shape conversion must keep a simple Zone within the canvas, without overlapping another Zone, and respect vertex snapping."
    });
    // Snapping is reconciled by runtime preparation, then checked on the final outline.
    if (!valid(nextEncounter, false)) { reject(); return; }
    const prepared = prepareValidatedEncounterChangeForRuntime({ currentEncounter: encounter, nextEncounter, action });
    void consumeEncounterChange(prepared, encounter, dispatch, resolved => {
      if (logEncounterValidationBlock(dispatch, resolved)) return;
      if (!valid(resolved.nextEncounter)) { reject(); return; }
      dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
    });
  };
}
