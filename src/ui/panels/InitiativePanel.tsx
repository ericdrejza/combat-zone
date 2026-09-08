import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Play,
  StepBack,
  StepForward,
  TimerReset,
  UserPlus,
  UserMinus,
  UserX,
  Users,
  View
} from "lucide-react";
import { MotionConfig, Reorder } from "motion/react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  addActorsToInitiative,
  advanceInitiative,
  clearInitiative,
  endInitiative,
  getInitiativeActorIds,
  getInitiativeEntry,
  removeActorFromInitiative,
  removeActorsFromInitiative,
  reorderInitiativeActor,
  retreatInitiative,
  startInitiative,
  updateInitiativeValue
} from "@core/encounter/initiativeMutations";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { Actor } from "@entities/actor/types";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { canToolSelectEntityType } from "@interaction/tools/toolRegistry";
import type { RootState } from "@store/store";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import {
  DEFAULT_INITIATIVE_PARTICIPANT_INTERACTION_STRATEGY,
  type InitiativeParticipantInteractionStrategy
} from "./initiative/participantInteractionStrategy";
import { useParticipantInteractions } from "./initiative/useParticipantInteractions";
import { useInitiativeActions } from "./initiative/useInitiativeActions";
import { InitiativeRow } from "./initiative/InitiativeRow";
import { useInitiativeReorderAutoScroll } from "./initiative/useInitiativeReorderAutoScroll";
import { useInitiativeTurnAutoScroll } from "./initiative/useInitiativeTurnAutoScroll";

const actionClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-canvas-line bg-canvas-surface text-canvas-ink disabled:cursor-not-allowed disabled:opacity-40";
const activeActionClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-canvas-ink bg-canvas-ink text-canvas-on-ink";

export function InitiativePanel({
  participantInteractionStrategy = DEFAULT_INITIATIVE_PARTICIPANT_INTERACTION_STRATEGY
}: {
  participantInteractionStrategy?: InitiativeParticipantInteractionStrategy;
} = {}) {
  const { animationsDisabled } = useMotionPreference();
  const { autoSelectActiveActor, setAutoSelectActiveActor } =
    useInterfacePreferences();
  const dispatch = useDispatch();
  const { commitInitiativeChange, encounter, logInvalidInitiativeValue } =
    useInitiativeActions();
  const { onParticipantClick, onParticipantDoubleClick } =
    useParticipantInteractions(participantInteractionStrategy);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const initiativeActorIds = getInitiativeActorIds(encounter);
  const [draftOrder, setDraftOrder] = useState(initiativeActorIds);
  const [confirmClear, setConfirmClear] = useState(false);
  const { listRef, stopAutoScroll, updateAutoScroll } =
    useInitiativeReorderAutoScroll();
  useInitiativeTurnAutoScroll(
    listRef,
    initiativeActorIds,
    encounter.initiativeTracker.currentActorId,
    animationsDisabled
  );
  const actors = initiativeActorIds
    .map((actorId) => encounter.actors.byId[actorId])
    .filter((actor): actor is Actor => Boolean(actor));
  const listedIds = new Set(initiativeActorIds);
  const selectedIds =
    selection.selectedEntityType === "actor"
      ? selection.selectedIds.filter((actorId) => !listedIds.has(actorId))
      : [];
  const selectedInitiativeIds =
    selection.selectedEntityType === "actor" ? selection.selectedIds : [];
  const selectedListedIds = selectedInitiativeIds.filter((actorId) =>
    listedIds.has(actorId)
  );
  const visibleIds = encounter.actors.allIds.filter(
    (actorId) =>
      encounter.actors.byId[actorId]?.currentZoneId !== ZONELESS_ACTOR_ZONE_ID &&
      !listedIds.has(actorId)
  );
  const allIds = encounter.actors.allIds.filter((actorId) => !listedIds.has(actorId));
  const { currentActorId, currentRound } = encounter.initiativeTracker;
  const currentIndex = currentActorId
    ? initiativeActorIds.indexOf(currentActorId)
    : -1;
  const previousChangesRound =
    currentRound !== null &&
    (actors.length === 0 || (currentRound > 1 && currentIndex === 0));
  const nextChangesRound =
    currentRound !== null &&
    (actors.length === 0 || currentIndex === actors.length - 1);

  useEffect(() => {
    setDraftOrder(initiativeActorIds);
  }, [encounter.initiativeTracker.entries]);

  function commitAdd(actorIds: string[], scope: string) {
    commitInitiativeChange(
      "initiative.addActors",
      { actorIds, scope },
      addActorsToInitiative(encounter, actorIds)
    );
  }

  function commitSimple(
    type: string,
    nextEncounter: typeof encounter,
    payload: Record<string, string | number | string[] | null> = {}
  ) {
    commitInitiativeChange(type, payload, nextEncounter);
  }

  function navigateInitiative(
    type: "initiative.next" | "initiative.previous",
    nextEncounter: typeof encounter
  ) {
    commitSimple(type, nextEncounter, {
      actorId: currentActorId,
      round: currentRound
    });
    const nextActorId = nextEncounter.initiativeTracker.currentActorId;
    if (!autoSelectActiveActor || !nextActorId) return;

    if (!canToolSelectEntityType(activeToolId, "actor")) {
      dispatch(setActiveTool("select"));
    }
    dispatch(selectEntity({ entityType: "actor", ids: [nextActorId] }));
  }

  return (
    <MotionConfig reducedMotion={animationsDisabled ? "always" : "never"}>
    <div className="space-y-3 text-sm">
      <div className="flex gap-1">
        <button aria-label="Add selected actors" className={actionClass} disabled={!selectedIds.length} onClick={() => commitAdd(selectedIds, "selected")} title="Add selected actors" type="button"><UserPlus aria-hidden="true" className="h-4 w-4" /></button>
        <button aria-label="Add visible actors" className={actionClass} disabled={!visibleIds.length} onClick={() => commitAdd(visibleIds, "visible")} title="Add visible actors" type="button"><View aria-hidden="true" className="h-4 w-4" /></button>
        <button aria-label="Add all actors" className={actionClass} disabled={!allIds.length} onClick={() => commitAdd(allIds, "all")} title="Add all actors" type="button"><Users aria-hidden="true" className="h-4 w-4" /></button>
        <button aria-label="Remove selected initiative actors" className={`${actionClass} ml-auto`} disabled={!selectedListedIds.length} onClick={() => commitSimple("initiative.removeActors", removeActorsFromInitiative(encounter, selectedListedIds), { actorIds: selectedListedIds })} title="Remove selected initiative actors" type="button"><UserMinus aria-hidden="true" className="h-4 w-4" /></button>
        <button aria-label="Remove all initiative actors" className={actionClass} disabled={!actors.length} onClick={() => setConfirmClear(true)} title="Remove all initiative actors" type="button"><UserX aria-hidden="true" className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center justify-between border-t border-canvas-line pt-3">
        <div className="flex gap-1">
          <button aria-label="Auto-select active actor" aria-pressed={autoSelectActiveActor} className={autoSelectActiveActor ? activeActionClass : actionClass} onClick={() => setAutoSelectActiveActor(!autoSelectActiveActor)} title="Auto-select active actor" type="button"><Crosshair aria-hidden="true" className="h-4 w-4" /></button>
          <button aria-label="End combat" className={actionClass} disabled={currentRound === null} onClick={() => commitSimple("initiative.end", endInitiative(encounter), { actorId: currentActorId, round: currentRound })} title="End combat" type="button"><TimerReset aria-hidden="true" className="h-4 w-4" /></button>
        </div>
        <span className="font-semibold">{currentRound === null ? "Not Started" : `Round ${currentRound}`}</span>
        <div className="flex gap-1">
          {currentRound !== null ? (
            <>
              <button aria-label={previousChangesRound ? "Previous round" : "Previous turn"} className={actionClass} disabled={currentRound === 1 && currentIndex <= 0} onClick={() => navigateInitiative("initiative.previous", retreatInitiative(encounter))} title={previousChangesRound ? "Previous round" : "Previous turn"} type="button">{previousChangesRound ? <StepBack aria-hidden="true" className="h-4 w-4" /> : <ChevronLeft aria-hidden="true" className="h-4 w-4" />}</button>
              <button aria-label={nextChangesRound ? "Next round" : "Next turn"} className={actionClass} onClick={() => navigateInitiative("initiative.next", advanceInitiative(encounter))} title={nextChangesRound ? "Next round" : "Next turn"} type="button">{nextChangesRound ? <StepForward aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}</button>
            </>
          ) : (
            <button aria-label="Start combat" className={actionClass} disabled={!actors.length} onClick={() => commitSimple("initiative.start", startInitiative(encounter))} title="Start combat" type="button"><Play aria-hidden="true" className="h-4 w-4" /></button>
          )}
        </div>
      </div>

      {actors.length ? (
        <Reorder.Group
          as="ol"
          axis="y"
          className="max-h-72 space-y-2 overflow-y-auto pr-1"
          onReorder={setDraftOrder}
          ref={listRef}
          values={draftOrder}
        >
          {draftOrder.map((actorId) => {
            const actor = encounter.actors.byId[actorId];
            return actor ? (
              <InitiativeRow
                active={actor.id === currentActorId}
                actor={actor}
                initiativeValue={getInitiativeEntry(encounter, actor.id)?.value}
                key={actor.id}
                onClick={(clickedActorId, event) =>
                  onParticipantClick(clickedActorId, {
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                    shiftKey: event.shiftKey
                  })
                }
                onDoubleClick={(clickedActorId, event) =>
                  onParticipantDoubleClick(clickedActorId, {
                    ctrlKey: event.ctrlKey,
                    metaKey: event.metaKey,
                    shiftKey: event.shiftKey
                  })
                }
                onDrag={updateAutoScroll}
                onDragEnd={(draggedActorId) =>
                  {
                    stopAutoScroll();
                    commitSimple(
                      "initiative.reorder",
                      reorderInitiativeActor(encounter, draggedActorId, draftOrder),
                      { actorId: draggedActorId, actorIds: draftOrder }
                    );
                  }
                }
                onInitiativeChange={(changedActorId, initiative) => {
                  commitSimple(
                    "initiative.updateValue",
                    updateInitiativeValue(encounter, changedActorId, initiative),
                    { actorId: changedActorId, initiative: initiative ?? null }
                  );
                }}
                onInvalidInitiative={logInvalidInitiativeValue}
                onRemove={(removedActorId) =>
                  commitSimple(
                    "initiative.removeActor",
                    removeActorFromInitiative(encounter, removedActorId),
                    { actorId: removedActorId }
                  )
                }
                selected={selectedInitiativeIds.includes(actor.id)}
              />
            ) : null;
          })}
        </Reorder.Group>
      ) : (
        <p className="rounded-xl border border-dashed border-canvas-line p-3 text-canvas-muted">Add actors to begin tracking initiative.</p>
      )}

      {confirmClear ? (
        <div aria-label="Confirm remove all initiative actors" aria-modal="true" className="viewport-overlay z-[70] flex items-center justify-center overflow-y-auto bg-black/30 p-6" role="dialog">
          <div className="w-[min(26rem,92vw)] rounded-3xl border border-canvas-line bg-canvas-surface p-5 shadow-2xl">
            <h3 className="font-display text-lg font-semibold">Clear initiative?</h3>
            <p className="mt-2 text-sm text-canvas-muted">This removes every participant and scoped initiative value. The active round is preserved, and you can undo this action.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-xl border border-canvas-line px-4 py-2" onClick={() => setConfirmClear(false)} type="button">Cancel</button>
              <button className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white" onClick={() => { commitSimple("initiative.clear", clearInitiative(encounter), { actorIds: initiativeActorIds }); setConfirmClear(false); }} type="button">Clear all</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </MotionConfig>
  );
}
