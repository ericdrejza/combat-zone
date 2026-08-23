import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Play,
  StepBack,
  StepForward,
  TimerReset,
  Trash2,
  UserPlus,
  Users,
  View
} from "lucide-react";
import { MotionConfig, Reorder, motion, useDragControls } from "motion/react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import {
  INITIATIVE_MAX,
  INITIATIVE_MIN,
  addActorsToInitiative,
  advanceInitiative,
  clearInitiative,
  endInitiative,
  removeActorFromInitiative,
  reorderInitiativeActor,
  retreatInitiative,
  startInitiative,
  updateInitiativeValue
} from "@core/encounter/initiativeMutations";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { Actor } from "@entities/actor/types";
import type { RootState } from "@store/store";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";
import { useInitiativeActions } from "./initiative/useInitiativeActions";

const actionClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-canvas-line bg-white text-canvas-ink disabled:cursor-not-allowed disabled:opacity-40";

const activeFactionClasses: Record<Actor["layoutGroup"], string> = {
  enemy: "border-red-500 bg-red-50",
  hero: "border-blue-500 bg-blue-50",
  neutral: "border-yellow-500 bg-yellow-50"
};

const activeIndicatorClasses: Record<Actor["layoutGroup"], string> = {
  enemy: "bg-red-600",
  hero: "bg-blue-600",
  neutral: "bg-yellow-600"
};

type InitiativeRowProps = {
  actor: Actor;
  active: boolean;
  onDragEnd: (actorId: string) => void;
  onInitiativeChange: (actorId: string, initiative: number | undefined) => void;
  onRemove: (actorId: string) => void;
};

function InitiativeRow({
  actor,
  active,
  onDragEnd,
  onInitiativeChange,
  onRemove
}: InitiativeRowProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      aria-current={active ? "step" : undefined}
      className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-sm ${
        active ? activeFactionClasses[actor.layoutGroup] : "border-canvas-line bg-white"
      }`}
      dragControls={dragControls}
      dragListener={false}
      onDragEnd={() => onDragEnd(actor.id)}
      value={actor.id}
    >
      <button
        aria-label={`Reorder ${actor.name}`}
        className="cursor-grab touch-none text-canvas-muted active:cursor-grabbing"
        onPointerDown={(event) => dragControls.start(event)}
        type="button"
      >
        <GripVertical aria-hidden="true" className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 truncate font-medium">{actor.name}</span>
      {active ? (
        <motion.span
          aria-label="Current actor"
          className={`h-2.5 w-2.5 rounded-full ${activeIndicatorClasses[actor.layoutGroup]}`}
          layoutId="initiative-current-actor"
        />
      ) : null}
      <input
        aria-label={`${actor.name} initiative`}
        className="w-14 rounded-lg border border-canvas-line px-2 py-1 text-right"
        defaultValue={actor.initiative ?? ""}
        key={`${actor.id}:${actor.initiative ?? "blank"}`}
        max={INITIATIVE_MAX}
        min={INITIATIVE_MIN}
        onBlur={(event) => {
          const value = event.currentTarget.value.trim();
          const initiative = value === "" ? undefined : Number(value);
          if (
            initiative === undefined ||
            (Number.isInteger(initiative) &&
              initiative >= INITIATIVE_MIN &&
              initiative <= INITIATIVE_MAX)
          ) {
            onInitiativeChange(actor.id, initiative);
          } else {
            event.currentTarget.value = actor.initiative?.toString() ?? "";
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        step={1}
        type="number"
      />
      <button
        aria-label={`Remove ${actor.name} from initiative`}
        className="text-canvas-muted hover:text-red-700"
        onClick={() => onRemove(actor.id)}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </button>
    </Reorder.Item>
  );
}

export function InitiativePanel() {
  const { animationsDisabled } = useMotionPreference();
  const { commitInitiativeChange, encounter } = useInitiativeActions();
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const [draftOrder, setDraftOrder] = useState(encounter.initiativeTracker.actorIds);
  const [confirmClear, setConfirmClear] = useState(false);
  const actors = encounter.initiativeTracker.actorIds
    .map((actorId) => encounter.actors.byId[actorId])
    .filter((actor): actor is Actor => Boolean(actor));
  const listedIds = new Set(encounter.initiativeTracker.actorIds);
  const selectedIds =
    selection.selectedEntityType === "actor"
      ? selection.selectedIds.filter((actorId) => !listedIds.has(actorId))
      : [];
  const visibleIds = encounter.actors.allIds.filter(
    (actorId) =>
      encounter.actors.byId[actorId]?.currentZoneId !== ZONELESS_ACTOR_ZONE_ID &&
      !listedIds.has(actorId)
  );
  const allIds = encounter.actors.allIds.filter((actorId) => !listedIds.has(actorId));
  const { currentActorId, currentRound } = encounter.initiativeTracker;
  const currentIndex = currentActorId
    ? encounter.initiativeTracker.actorIds.indexOf(currentActorId)
    : -1;

  useEffect(() => {
    setDraftOrder(encounter.initiativeTracker.actorIds);
  }, [encounter.initiativeTracker.actorIds]);

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

  return (
    <MotionConfig reducedMotion={animationsDisabled ? "always" : "never"}>
    <div className="space-y-3 text-sm">
      <div className="flex gap-1">
        <button aria-label="Add selected actors" className={actionClass} disabled={!selectedIds.length} onClick={() => commitAdd(selectedIds, "selected")} title="Add selected actors" type="button"><UserPlus aria-hidden="true" className="h-4 w-4" /></button>
        <button aria-label="Add visible actors" className={actionClass} disabled={!visibleIds.length} onClick={() => commitAdd(visibleIds, "visible")} title="Add visible actors" type="button"><View aria-hidden="true" className="h-4 w-4" /></button>
        <button aria-label="Add all actors" className={actionClass} disabled={!allIds.length} onClick={() => commitAdd(allIds, "all")} title="Add all actors" type="button"><Users aria-hidden="true" className="h-4 w-4" /></button>
        <button aria-label="Remove all initiative actors" className={`${actionClass} ml-auto`} disabled={!actors.length} onClick={() => setConfirmClear(true)} title="Remove all initiative actors" type="button"><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center gap-1 border-t border-canvas-line pt-3">
        <span className="mr-1 font-semibold">{currentRound === null ? "Not Started" : `Round ${currentRound}`}</span>
        <div className="ml-auto flex gap-1">
          {currentActorId ? (
            <>
              <button aria-label="End combat" className={actionClass} disabled={!currentActorId} onClick={() => commitSimple("initiative.end", endInitiative(encounter), { actorId: currentActorId, round: currentRound })} title="End combat" type="button"><TimerReset aria-hidden="true" className="h-4 w-4" /></button>
              <button aria-label="Previous turn" className={actionClass} disabled={currentRound === 1 && currentIndex === 0} onClick={() => commitSimple("initiative.previous", retreatInitiative(encounter), { actorId: currentActorId, round: currentRound })} title={currentIndex === 0 && currentRound !== 1 ? "Previous round" : "Previous turn"} type="button">{currentIndex === 0 && currentRound !== 1 ? <StepBack aria-hidden="true" className="h-4 w-4" /> : <ChevronLeft aria-hidden="true" className="h-4 w-4" />}</button>
              <button aria-label="Next turn" className={actionClass} onClick={() => commitSimple("initiative.next", advanceInitiative(encounter), { actorId: currentActorId, round: currentRound })} title={currentIndex === actors.length - 1 ? "Next round" : "Next turn"} type="button">{currentIndex === actors.length - 1 ? <StepForward aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}</button>
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
          values={draftOrder}
        >
          {draftOrder.map((actorId) => {
            const actor = encounter.actors.byId[actorId];
            return actor ? (
              <InitiativeRow
                active={actor.id === currentActorId}
                actor={actor}
                key={actor.id}
                onDragEnd={(draggedActorId) =>
                  commitSimple(
                    "initiative.reorder",
                    reorderInitiativeActor(encounter, draggedActorId, draftOrder),
                    { actorId: draggedActorId, actorIds: draftOrder }
                  )
                }
                onInitiativeChange={(changedActorId, initiative) =>
                  commitSimple(
                    "initiative.updateValue",
                    updateInitiativeValue(encounter, changedActorId, initiative),
                    { actorId: changedActorId, initiative: initiative ?? null }
                  )
                }
                onRemove={(removedActorId) =>
                  commitSimple(
                    "initiative.removeActor",
                    removeActorFromInitiative(encounter, removedActorId),
                    { actorId: removedActorId }
                  )
                }
              />
            ) : null;
          })}
        </Reorder.Group>
      ) : (
        <p className="rounded-xl border border-dashed border-canvas-line p-3 text-canvas-muted">Add actors to begin tracking initiative.</p>
      )}

      {confirmClear ? (
        <div aria-label="Confirm remove all initiative actors" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-6" role="dialog">
          <div className="w-[min(26rem,92vw)] rounded-3xl border border-canvas-line bg-white p-5 shadow-2xl">
            <h3 className="font-display text-lg font-semibold">Clear initiative?</h3>
            <p className="mt-2 text-sm text-canvas-muted">This removes every actor from initiative and ends the active combat. You can undo this action.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-xl border border-canvas-line px-4 py-2" onClick={() => setConfirmClear(false)} type="button">Cancel</button>
              <button className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white" onClick={() => { commitSimple("initiative.clear", clearInitiative(encounter), { actorIds: encounter.initiativeTracker.actorIds }); setConfirmClear(false); }} type="button">Clear all</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </MotionConfig>
  );
}
