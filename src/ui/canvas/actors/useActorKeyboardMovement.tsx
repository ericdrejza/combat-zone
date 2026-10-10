import { useCombatPreferences } from '@ui/combat_preferences/CombatPreferenceProvider';
import { stepSpatialActors } from '@core/movement/movementStrategies';
import { useEffect, useRef, useState } from "react";
import { useSelector, useStore } from "react-redux";
import type { EncounterState } from "@core/encounter/types";
import { moveActorsByDestination, stepActorSizes } from "@entities/actor/actorKeyboardMutations";
import type { RootState } from "@store/store";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { matchesKeybind, useKeybinds } from "@ui/keybinds";
import { ignoreShortcut } from "@ui/keybinds/keyboardGuards";
import { ConfirmStatusDialog } from "@ui/panels/status_panel/StatusDialog";
import { useKeyboardEncounterCommit } from "@ui/canvas/useKeyboardEncounterCommit";
import { buildOriginMovements, type MoveDirection, type OriginMovement } from "./directionalActorMovement";
import { ActorMovementChoiceOverlay } from "./ActorMovementChoiceOverlay";
import { ActorSkillCheckDialog } from "./ActorSkillCheckDialog";

type Workflow = {
  token: number; snapshot: EncounterState; selectionKey: string; tool: string; direction: MoveDirection;
  origins: OriginMovement[]; cursor: number; stage: "choose" | "skill" | "warning" | "commit";
  destinations: Record<string, string>; skillActorIds: string[];
};
const directions = ["up", "down", "left", "right"] as const;
const actionIds = ["actor.moveUp", "actor.moveDown", "actor.moveLeft", "actor.moveRight"] as const;

/** Keeps route choice and adjudication outside Redux until one validated batch is ready. */
export function useActorKeyboardMovement() {
  const encounter = useSelector((s: RootState) => s.encounter.present);
  const selection = useSelector((s: RootState) => s.interaction.selection);
  const tool = useSelector((s: RootState) => s.interaction.activeToolId);
  const store = useStore<RootState>();
  const { readOnly } = usePersistence();
  const { bindings } = useKeybinds();
  const { warnActorDestinationsDiffer, setWarnActorDestinationsDiffer } = useInterfacePreferences();
  const commit = useKeyboardEncounterCommit();
  const nextToken = useRef(0);
  const spatialMovePending = useRef(false);
  const lastSpatialStep = useRef<{ direction: MoveDirection; time: number } | null>(null);
  const { movementRepeatDelayMs } = useCombatPreferences();
  const [flow, setFlow] = useState<Workflow | null>(null);
  const flowRef = useRef(flow); flowRef.current = flow;
  const [suppress, setSuppress] = useState(false);
  const selectionKey = `${selection.selectedEntityType}:${selection.selectedIds.join("|")}`;
  const eligible = (["actor", "select", "grid", "free"].includes(tool)) && selection.selectedEntityType === "actor" && selection.selectedIds.length > 0;
  const cancel = () => { flowRef.current = null; setFlow(null); setSuppress(false); };
  function current(draft: Workflow) {
    const state = store.getState();
    return isPersistenceWritable() && flowRef.current?.token === draft.token && state.encounter.present === draft.snapshot && state.interaction.activeToolId === draft.tool && `${state.interaction.selection.selectedEntityType}:${state.interaction.selection.selectedIds.join("|")}` === draft.selectionKey;
  }
  useEffect(() => {
    if (flow && (readOnly || encounter !== flow.snapshot || selectionKey !== flow.selectionKey || tool !== flow.tool)) cancel();
  }, [encounter, selectionKey, tool, readOnly, flow]);

  function apply(draft: Workflow) {
    if (!current(draft)) { cancel(); return; }
    const next = { ...draft, stage: "commit" as const }; flowRef.current = next; setFlow(next);
    void commit("actor.moveMany", { actorIds: Object.keys(draft.destinations), destinations: draft.destinations },
      (state) => moveActorsByDestination(state, draft.destinations), () => current(draft)).finally(() => { if (flowRef.current?.token === draft.token) cancel(); });
  }
  function finish(draft: Workflow) {
    if (!current(draft)) { cancel(); return; }
    if (!Object.entries(draft.destinations).some(([id, zone]) => draft.snapshot.actors.byId[id].currentZoneId !== zone)) { cancel(); return; }
    const finalZones = draft.origins.flatMap((origin) => origin.actorIds.map((id) => draft.destinations[id] ?? draft.snapshot.actors.byId[id].currentZoneId));
    if (warnActorDestinationsDiffer && new Set(finalZones).size > 1) {
      const next = { ...draft, stage: "warning" as const }; flowRef.current = next; setFlow(next);
    } else apply(draft);
  }
  function resolve(draft: Workflow) {
    const destinations: Record<string, string> = {}; const skillActorIds: string[] = [];
    for (const origin of draft.origins) {
      const candidate = origin.candidates[origin.index]; if (!candidate) continue;
      for (const id of origin.actorIds) {
        destinations[id] = candidate.zoneId;
        if (candidate.skillCheck) skillActorIds.push(id);
      }
    }
    const next = { ...draft, destinations, skillActorIds, stage: "skill" as const }; flowRef.current = next; setFlow(next);
    if (!skillActorIds.length) finish(next);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const draft = flowRef.current;
      if (draft?.stage === "choose") {
        if (ignoreShortcut(event)) return;
        if (event.key === "Escape") { event.preventDefault(); cancel(); return; }
        const horizontal = draft.direction === "left" || draft.direction === "right";
        const step = event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ? 0 : event.key === (horizontal ? "ArrowUp" : "ArrowLeft") ? -1 : event.key === (horizontal ? "ArrowDown" : "ArrowRight") ? 1 : 0;
        const confirm = event.key === "Enter" || matchesKeybind(event, bindings[actionIds[directions.indexOf(draft.direction)]]);
        if (!step && !confirm) return;
        event.preventDefault(); if (event.repeat) return;
        if (!current(draft)) { cancel(); return; }
        if (step) {
          const origins = draft.origins.map((origin, index) => index === draft.cursor ? { ...origin, index: (origin.index + step + origin.candidates.length) % origin.candidates.length } : origin);
          const next = { ...draft, origins }; flowRef.current = next; setFlow(next);
        } else {
          const cursor = draft.origins.findIndex((origin, index) => index > draft.cursor && origin.candidates.length > 1);
          if (cursor < 0) resolve(draft); else { const next = { ...draft, cursor }; flowRef.current = next; setFlow(next); }
        }
        return;
      }
      if (!eligible || readOnly || ignoreShortcut(event)) return;
      const sizeDirection = matchesKeybind(event, bindings["actor.sizeDecrease"]) ? -1 : matchesKeybind(event, bindings["actor.sizeIncrease"]) ? 1 : 0;
      if (sizeDirection) {
        event.preventDefault(); if (draft) return;
        const ids = [...selection.selectedIds];
        void commit("actor.updateProperties", { actorIds: ids, sizeStep: sizeDirection }, (state) => stepActorSizes(state, ids, sizeDirection), () => store.getState().encounter.present === encounter && store.getState().interaction.activeToolId === tool && `${store.getState().interaction.selection.selectedEntityType}:${store.getState().interaction.selection.selectedIds.join("|")}` === selectionKey);
        return;
      }
      const index = actionIds.findIndex((id) => matchesKeybind(event, bindings[id])); if (index < 0) return;
      event.preventDefault(); if ((event.repeat && encounter.movementStrategy === 'zone') || draft || !isPersistenceWritable()) return;
      const direction = directions[index];
      if (encounter.movementStrategy !== 'zone') {
        const vector = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[direction];
        // Accept native key repeat without overlapping async validation or queuing moves after release.
        if (spatialMovePending.current) return;
        const now = performance.now();
        if (event.repeat && lastSpatialStep.current?.direction === direction && now - lastSpatialStep.current.time < movementRepeatDelayMs) return;
        lastSpatialStep.current = { direction, time: now };
        const snapshot = store.getState().encounter.present;
        const actorIds = [...selection.selectedIds];
        spatialMovePending.current = true;
        void commit('actor.moveSpatial', { actorIds, direction }, state => stepSpatialActors(state, actorIds, vector), () => {
          const current = store.getState();
          return current.encounter.present === snapshot && current.interaction.activeToolId === tool
            && `${current.interaction.selection.selectedEntityType}:${current.interaction.selection.selectedIds.join('|')}` === selectionKey;
        }).finally(() => { spatialMovePending.current = false; });
        return;
      }
      const origins = buildOriginMovements(encounter, selection.selectedIds, direction);
      if (!origins.some((origin) => origin.candidates.length)) return;
      const cursor = origins.findIndex((origin) => origin.candidates.length > 1);
      const next: Workflow = { token: ++nextToken.current, snapshot: encounter, selectionKey, tool, direction, origins, cursor, destinations: {}, skillActorIds: [], stage: "choose" };
      flowRef.current = next; setFlow(next);
      if (cursor < 0) resolve(next);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const summaries = flow?.origins.map((origin) => {
    const candidate = origin.candidates[origin.index]; if (!candidate) return null;
    const names = origin.actorIds.map((id) => encounter.actors.byId[id]?.name).sort().join(", ");
    return `${names}: ${encounter.zones.byId[origin.originId]?.name} -> ${encounter.zones.byId[candidate.zoneId]?.name}${candidate.tags.length ? ` [${candidate.tags.join(", ")}]` : ""}`;
  }).filter(Boolean).join("; ");
  const choosing = flow?.stage === "choose" ? flow.origins[flow.cursor] : undefined;
  const candidateZone = choosing && encounter.zones.byId[choosing.candidates[choosing.index].zoneId];
  return {
    summary: flow ? `${summaries}${choosing ? " — perpendicular arrows choose; Enter confirms; Escape cancels" : ""}` : undefined,
    overlay: candidateZone && flow ? <ActorMovementChoiceOverlay zone={candidateZone} direction={flow.direction} /> : null,
    dialog: flow?.stage === "skill" ? <ActorSkillCheckDialog actors={flow.skillActorIds.map((id) => encounter.actors.byId[id])} routes={Object.fromEntries(flow.skillActorIds.map((id) => [id, `${encounter.zones.byId[encounter.actors.byId[id].currentZoneId]?.name} -> ${encounter.zones.byId[flow.destinations[id]]?.name}`]))} onClose={cancel} onProceed={(decisions) => {
      const destinations = { ...flow.destinations }; for (const [id, move] of Object.entries(decisions)) if (!move) delete destinations[id];
      finish({ ...flow, destinations });
    }} /> : flow?.stage === "warning" ? <ConfirmStatusDialog title="Actor destinations differ" confirmLabel="Continue" onClose={cancel} onConfirm={() => { if (!current(flow)) { cancel(); return; } if (suppress) setWarnActorDestinationsDiffer(false); apply(flow); }}>
      <p>Selected actors will end in different zones.</p><label className="mt-3 flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-canvas-surface focus-within:ring-2 focus-within:ring-canvas-ink"><input type="checkbox" checked={suppress} onChange={(event) => setSuppress(event.currentTarget.checked)} />Don’t show this warning again</label>
    </ConfirmStatusDialog> : null
  };
}
