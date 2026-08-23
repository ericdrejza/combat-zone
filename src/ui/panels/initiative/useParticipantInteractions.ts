import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setCurrentInitiativeActor } from "@core/encounter/initiativeMutations";
import { getInitiativeActorIds } from "@core/encounter/initiativeMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { canToolSelectEntityType } from "@interaction/tools/toolRegistry";
import type { RootState } from "@store/store";
import type {
  InitiativeParticipantInteractionStrategy,
  InitiativeParticipantSelectionModifiers
} from "./participantInteractionStrategy";
import { useInitiativeActions } from "./useInitiativeActions";

const DOUBLE_CLICK_DELAY_MS = 250;

/** Arbitrates click gestures so a double-click never also selects the actor. */
export function useParticipantInteractions(
  strategy: InitiativeParticipantInteractionStrategy
) {
  const dispatch = useDispatch();
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const selection = useSelector(
    (state: RootState) => state.interaction.selection
  );
  const { commitInitiativeChange, encounter } = useInitiativeActions();
  const pendingSingleClick = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pendingSingleClick.current) clearTimeout(pendingSingleClick.current);
    },
    []
  );

  function executeIntent(
    actorId: string,
    gesture: "singleClick" | "doubleClick",
    modifiers: InitiativeParticipantSelectionModifiers
  ) {
    const intent = strategy.resolveIntent(gesture, {
      combatStarted: encounter.initiativeTracker.currentRound !== null,
      modifiers
    });

    if (intent === "selectActor") {
      if (!canToolSelectEntityType(activeToolId, "actor")) {
        dispatch(setActiveTool("select"));
      }
      if (modifiers.shiftKey) {
        const initiativeIds = getInitiativeActorIds(encounter);
        const existingActorIds =
          selection.selectedEntityType === "actor" ? selection.selectedIds : [];
        const anchorId =
          [...existingActorIds].reverse().find((id) => initiativeIds.includes(id));
        const anchorIndex = anchorId
          ? initiativeIds.indexOf(anchorId)
          : -1;
        const targetIndex = initiativeIds.indexOf(actorId);
        const rangeIds =
          anchorIndex >= 0 && targetIndex >= 0
            ? initiativeIds.slice(
                Math.min(anchorIndex, targetIndex),
                Math.max(anchorIndex, targetIndex) + 1
              )
            : [actorId];
        const ids = [...new Set([...existingActorIds, ...rangeIds])];
        dispatch(selectEntity({ entityType: "actor", ids }));
      } else {
        dispatch(
          selectEntity({
            entityType: "actor",
            ids: [actorId],
            toggle: modifiers.ctrlKey || modifiers.metaKey
          })
        );
      }
      return;
    }
    if (intent === "makeCurrent") {
      commitInitiativeChange(
        "initiative.setCurrent",
        { actorId },
        setCurrentInitiativeActor(encounter, actorId)
      );
    }
  }

  function onParticipantClick(
    actorId: string,
    modifiers: InitiativeParticipantSelectionModifiers
  ) {
    if (pendingSingleClick.current) clearTimeout(pendingSingleClick.current);
    pendingSingleClick.current = setTimeout(() => {
      pendingSingleClick.current = null;
      executeIntent(actorId, "singleClick", modifiers);
    }, DOUBLE_CLICK_DELAY_MS);
  }

  function onParticipantDoubleClick(
    actorId: string,
    modifiers: InitiativeParticipantSelectionModifiers
  ) {
    if (pendingSingleClick.current) {
      clearTimeout(pendingSingleClick.current);
      pendingSingleClick.current = null;
    }
    executeIntent(actorId, "doubleClick", modifiers);
  }

  return { onParticipantClick, onParticipantDoubleClick };
}
