import { useRef, useState } from "react";
import { useDispatch } from "react-redux";

import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { readImageFile } from "./readImageFile";

type BackgroundAction = "add" | "replace";

export function useBackgroundTool(encounter: EncounterState) {
  const dispatch = useDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackgroundAction, setPendingBackgroundAction] =
    useState<BackgroundAction>("add");

  function requestBackgroundUpload(action: BackgroundAction) {
    setPendingBackgroundAction(action);
    fileInputRef.current?.click();
  }

  async function handleBackgroundFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    const nextBackgroundImage = await readImageFile(file);
    const actionType =
      pendingBackgroundAction === "replace"
        ? "background.replace"
        : "background.add";

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord(actionType, {
          backgroundImage: nextBackgroundImage
        }),
        nextEncounter: {
          ...encounter,
          backgroundImage: nextBackgroundImage
        }
      })
    );
    dispatch(setActiveTool("zone"));
  }

  function deleteBackground() {
    if (!encounter.backgroundImage) {
      return;
    }

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("background.delete", {
          backgroundImageName: encounter.backgroundImage.name
        }),
        nextEncounter: {
          ...encounter,
          backgroundImage: null
        }
      })
    );
  }

  return {
    deleteBackground,
    fileInputRef,
    handleBackgroundFileChange,
    requestBackgroundUpload
  };
}
