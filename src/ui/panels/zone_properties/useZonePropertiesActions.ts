import { getPaintableZoneProperties } from "@ui/canvas/zones/zonePropertyTransfers";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { consumeEncounterChange } from "@store/consumeEncounterChange";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/runtimeEncounterChange";
import type { Zone } from "@entities/zone/types";
import {
  deleteZone,
  type UpdateZonePropertiesInput,
  updateZoneProperties
} from "@entities/zone/zoneMutations";
import {
  clearZoneOpacityPreview,
  clearSelection,
  setZoneOpacityPreview,
  toggleZonePaintBrush
} from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";
import { getExportableZoneProperties } from "./options";

function toZonePropertiesInput(
  properties: Partial<Zone>
): UpdateZonePropertiesInput {
  return {
    ...(properties.autoResize !== undefined
      ? { autoResize: properties.autoResize }
      : {}),
    ...(properties.layoutOrientation !== undefined
      ? { layoutOrientation: properties.layoutOrientation }
      : {}),
    ...(properties.layoutStrategy !== undefined
      ? { layoutStrategy: properties.layoutStrategy }
      : {}),
    ...(properties.colorBorder !== undefined
      ? { colorBorder: properties.colorBorder }
      : {}),
    ...(properties.colorEngagement !== undefined
      ? { colorEngagement: properties.colorEngagement }
      : {}),
    ...(properties.colorFill !== undefined
      ? { colorFill: properties.colorFill }
      : {}),
    ...(properties.name !== undefined ? { name: properties.name } : {}),
    ...(properties.namePosition !== undefined
      ? { namePosition: properties.namePosition }
      : {}),
    ...(properties.opacity !== undefined ? { opacity: properties.opacity } : {}),
    ...(properties.matchEngagementColorToBorder !== undefined
      ? {
          matchEngagementColorToBorder:
            properties.matchEngagementColorToBorder
        }
      : {}),
    ...(properties.showBorder !== undefined
      ? { showBorder: properties.showBorder }
      : {}),
    ...(properties.showName !== undefined
      ? { showName: properties.showName }
      : {}),
    ...(properties.showSectionDividers !== undefined
      ? { showSectionDividers: properties.showSectionDividers }
      : {}),
    ...(properties.tags !== undefined ? { tags: properties.tags } : {})
  };
}

export function useZonePropertiesActions() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const zonePaintBrush = useSelector(
    (state: RootState) => state.interaction.zonePaintBrush
  );
  const selectedZoneIds =
    selection.selectedEntityType === "zone" ? selection.selectedIds : [];
  const selectedZone = encounter.zones.byId[selectedZoneIds[0]];

  function commitZoneProperties(properties: Partial<Zone>) {
    if (!selectedZone) {
      return;
    }

    const zonePatch = toZonePropertiesInput(properties);
    const nextEncounter = updateZoneProperties(
      encounter,
      selectedZone.id,
      zonePatch
    );

    if (nextEncounter === encounter) {
      return;
    }

    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("zone.updateProperties", {
        properties: zonePatch,
        zoneId: selectedZone.id
      }),
      currentEncounter: encounter,
      nextEncounter
    });
    const commitPrepared = (resolved: Awaited<typeof prepared>) => {
      if (resolved.blocked) {
        logEncounterValidationBlock(dispatch, resolved);
        if (properties.opacity !== undefined) {
          dispatch(clearZoneOpacityPreview());
        }
        return;
      }

      dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );

      if (properties.opacity !== undefined) {
        dispatch(clearZoneOpacityPreview());
      }
    };

    void consumeEncounterChange(prepared, encounter, dispatch, commitPrepared);
  }

  function commitZoneDelete() {
    if (!selectedZone) {
      return;
    }

    const connectedEdgeIds = encounter.edges.allIds.filter((edgeId) => {
      const edge = encounter.edges.byId[edgeId];

      return (
        edge?.fromZoneId === selectedZone.id || edge?.toZoneId === selectedZone.id
      );
    });
    const containedActorIds = encounter.actors.allIds.filter(
      (actorId) => encounter.actors.byId[actorId]?.currentZoneId === selectedZone.id
    );
    const containedEngagementIds = encounter.engagements.allIds.filter(
      (engagementId) =>
        encounter.engagements.byId[engagementId]?.parentZoneId === selectedZone.id
    );
    const nextEncounter = deleteZone(encounter, selectedZone.id);

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.delete", {
          zoneId: selectedZone.id,
          connectedEdgeIds,
          containedActorIds,
          containedEngagementIds
        }),
        nextEncounter
      })
    );
    dispatch(clearSelection());
  }

  function activateZonePaintBrush() {
    if (!selectedZone || !isPersistenceWritable()) return;
    dispatch(toggleZonePaintBrush({ sourceZoneId: selectedZone.id }));
    if (zonePaintBrush || selectedZoneIds.length < 2) return;
    const properties = getPaintableZoneProperties(selectedZone);
    const targetZoneIds = [...new Set(selectedZoneIds)].filter(id => {
      const target = encounter.zones.byId[id];
      return target && id !== selectedZone.id && Object.entries(properties).some(
        ([key, value]) => target[key as keyof Zone] !== value);
    });
    const nextEncounter = targetZoneIds.reduce(
      (state, id) => updateZoneProperties(state, id, properties), encounter);
    if (nextEncounter === encounter) return;
    const prepared = prepareValidatedEncounterChangeForRuntime({
      currentEncounter: encounter, nextEncounter,
      action: createEncounterActionRecord("zone.paintColors", {
        sourceZoneId: selectedZone.id, targetZoneIds, properties
      })
    });
    void consumeEncounterChange(prepared, encounter, dispatch, resolved => {
      if (logEncounterValidationBlock(dispatch, resolved)) return;
      dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
    });
  }

  function previewZoneOpacity(opacity: number) {
    if (selectedZone) {
      dispatch(setZoneOpacityPreview({ opacity, zoneId: selectedZone.id }));
    }
  }

  function cancelZoneOpacityPreview() {
    dispatch(clearZoneOpacityPreview());
  }

  function exportSourcePropertiesToSelection() {
    if (!selectedZone || selectedZoneIds.length < 2) {
      return;
    }

    const exportableProperties = getExportableZoneProperties(selectedZone);
    const nextEncounter = selectedZoneIds
      .slice(1)
      .reduce(
        (currentEncounter, zoneId) =>
          updateZoneProperties(currentEncounter, zoneId, exportableProperties),
        encounter
      );

    if (nextEncounter === encounter) {
      return;
    }

    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord("zone.exportProperties", {
        properties: exportableProperties,
        sourceZoneId: selectedZone.id,
        targetZoneIds: selectedZoneIds.slice(1)
      }),
      currentEncounter: encounter,
      nextEncounter
    });
    const commitPrepared = (resolved: Awaited<typeof prepared>) => {
      if (resolved.blocked) {
        logEncounterValidationBlock(dispatch, resolved);
        return;
      }

      dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );
    };

    void consumeEncounterChange(prepared, encounter, dispatch, commitPrepared);
  }

  return {
    activateZonePaintBrush,
    cancelZoneOpacityPreview,
    commitZoneDelete,
    commitZoneProperties,
    encounter,
    exportSourcePropertiesToSelection,
    previewZoneOpacity,
    selectedZone,
    selectedZoneIds,
    zonePaintBrush
  };
}
