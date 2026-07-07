import { useEffect } from "react";
import type { Dispatch } from "redux";

import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import { deleteZone } from "../../entities/zone/zoneMutations";
import {
  clearSelection,
  clearZonePaintBrush,
  selectEntity,
  setZoneShapeMode
} from "../../interaction/interactionState";
import { commitEncounterChange } from "../../store/encounterSlice";
import type { RootState } from "../../store/store";
import { sortZoneIdsByPosition } from "./zoneGeometry";

type UseCanvasKeyboardInput = {
  activeToolId: RootState["interaction"]["activeToolId"];
  clearShapeDraft: () => void;
  clearZoneDraftPoints: () => void;
  closeZoneShapeMenu: () => void;
  dispatch: Dispatch;
  encounter: RootState["encounter"]["present"];
  selection: RootState["interaction"]["selection"];
  zonePaintBrush: RootState["interaction"]["zonePaintBrush"];
};

export function useCanvasKeyboard({
  activeToolId,
  clearShapeDraft,
  clearZoneDraftPoints,
  closeZoneShapeMenu,
  dispatch,
  encounter,
  selection,
  zonePaintBrush
}: UseCanvasKeyboardInput) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (
        event.key === "Delete" &&
        selection.selectedEntityType === "zone" &&
        selection.selectedIds.length > 0
      ) {
        event.preventDefault();

        const nextEncounter = selection.selectedIds.reduce(
          (currentEncounter, zoneId) => deleteZone(currentEncounter, zoneId),
          encounter
        );

        dispatch(
          commitEncounterChange({
            action: createEncounterActionRecord("zone.delete", {
              zoneIds: selection.selectedIds
            }),
            nextEncounter
          })
        );
        dispatch(clearSelection());
        return;
      }

      if (
        event.key.toLowerCase() === "a" &&
        (event.ctrlKey || event.metaKey) &&
        (activeToolId === "zone" || activeToolId === "select")
      ) {
        event.preventDefault();
        dispatch(
          selectEntity({
            entityType: "zone",
            ids: encounter.zones.allIds
          })
        );
        return;
      }

      if (
        event.key === "Tab" &&
        selection.selectedEntityType === "zone" &&
        selection.selectedIds.length > 0
      ) {
        const sortedZoneIds = sortZoneIdsByPosition(encounter.zones);
        const selectedIndex = sortedZoneIds.indexOf(selection.selectedIds[0]);

        if (selectedIndex >= 0 && sortedZoneIds.length > 0) {
          event.preventDefault();
          const direction = event.shiftKey ? -1 : 1;
          const nextIndex =
            (selectedIndex + direction + sortedZoneIds.length) %
            sortedZoneIds.length;

          dispatch(
            selectEntity({
              entityType: "zone",
              ids: [sortedZoneIds[nextIndex]]
            })
          );
          return;
        }
      }

      if (event.key === "Escape" && zonePaintBrush) {
        event.preventDefault();
        dispatch(clearZonePaintBrush());
        return;
      }

      if (activeToolId !== "zone") {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        dispatch(clearZonePaintBrush());
        clearShapeDraft();
        clearZoneDraftPoints();
      }

      if (event.key === "1") {
        event.preventDefault();
        dispatch(setZoneShapeMode("rectangle"));
        closeZoneShapeMenu();
        clearZoneDraftPoints();
      }

      if (event.key === "2") {
        event.preventDefault();
        dispatch(setZoneShapeMode("circle"));
        closeZoneShapeMenu();
        clearZoneDraftPoints();
      }

      if (event.key === "3") {
        event.preventDefault();
        dispatch(setZoneShapeMode("hexagon"));
        closeZoneShapeMenu();
        clearZoneDraftPoints();
      }

      if (event.key === "4") {
        event.preventDefault();
        dispatch(setZoneShapeMode("polygon"));
        closeZoneShapeMenu();
        clearShapeDraft();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeToolId,
    clearShapeDraft,
    clearZoneDraftPoints,
    closeZoneShapeMenu,
    dispatch,
    encounter,
    selection.selectedEntityType,
    selection.selectedIds,
    zonePaintBrush
  ]);
}
