import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { Zone } from "@entities/zone/types";
import {
  deleteZone,
  type UpdateZonePropertiesInput,
  updateZoneProperties
} from "@entities/zone/zoneMutations";
import {
  clearSelection,
  setLastZoneOpacity,
  toggleZonePaintBrush
} from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { getExportableZoneProperties } from "./options";

function toZonePropertiesInput(
  properties: Partial<Zone>
): UpdateZonePropertiesInput {
  return {
    ...(properties.layoutOrientation !== undefined
      ? { layoutOrientation: properties.layoutOrientation }
      : {}),
    ...(properties.layoutStrategy !== undefined
      ? { layoutStrategy: properties.layoutStrategy }
      : {}),
    ...(properties.colorBorder !== undefined
      ? { colorBorder: properties.colorBorder }
      : {}),
    ...(properties.colorFill !== undefined
      ? { colorFill: properties.colorFill }
      : {}),
    ...(properties.name !== undefined ? { name: properties.name } : {}),
    ...(properties.namePosition !== undefined
      ? { namePosition: properties.namePosition }
      : {}),
    ...(properties.opacity !== undefined ? { opacity: properties.opacity } : {}),
    ...(properties.showBorder !== undefined
      ? { showBorder: properties.showBorder }
      : {}),
    ...(properties.showName !== undefined
      ? { showName: properties.showName }
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

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.updateProperties", {
          zoneId: selectedZone.id,
          properties: zonePatch
        }),
        nextEncounter
      })
    );

    if (properties.opacity !== undefined) {
      dispatch(setLastZoneOpacity(properties.opacity));
    }
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
    if (!selectedZone) {
      return;
    }

    dispatch(toggleZonePaintBrush({ sourceZoneId: selectedZone.id }));
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

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.exportProperties", {
          properties: exportableProperties,
          sourceZoneId: selectedZone.id,
          targetZoneIds: selectedZoneIds.slice(1)
        }),
        nextEncounter
      })
    );
    dispatch(setLastZoneOpacity(selectedZone.opacity));
  }

  return {
    activateZonePaintBrush,
    commitZoneDelete,
    commitZoneProperties,
    encounter,
    exportSourcePropertiesToSelection,
    selectedZone,
    selectedZoneIds,
    zonePaintBrush
  };
}
