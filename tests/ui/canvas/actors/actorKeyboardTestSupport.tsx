import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterState } from "@core/encounter/types";
import type { Edge } from "@entities/edge/types";
import { actor, collection, zoneA } from "@tests/entities/actor/actorMutationsTestSupport";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { loadEncounterState } from "@store/encounterSlice";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { InterfacePreferenceProvider } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { CombatPreferenceProvider } from "@ui/combat_preferences/CombatPreferenceProvider";
import { KeybindProvider } from "@ui/keybinds";
import { ZoneResizeApprovalProvider } from "@ui/zoneResizeApproval";
import { ActorHealthKeyboard } from "@ui/canvas/actors/ActorHealthKeyboard";
import { useActorKeyboardMovement } from "@ui/canvas/actors/useActorKeyboardMovement";

export function encounter(): EncounterState {
  const initial = createEncounterState({ id: "keyboard", name: "Keyboard" });
  initial.canvasSize = { width: 1200, height: 800 };
  const roomy = { ...zoneA, polygon: zoneA.polygon.map((p) => ({ x: p.x * 2, y: p.y * 2 })) };
  initial.zones = collection([roomy, { ...roomy, id: "b", name: "Upper", polygon: roomy.polygon.map((p) => ({ x: p.x + 300, y: p.y })) }, { ...roomy, id: "c", name: "Lower", polygon: roomy.polygon.map((p) => ({ x: p.x + 300, y: p.y + 200 })) }]);
  initial.actors = collection([{ ...actor, id: "alpha", name: "Alpha", size: "small", hitPoints: { current: 10, maximum: 20 } }, { ...actor, id: "bravo", name: "Bravo", size: "small", hitPoints: { current: 8, maximum: 20 } }]);
  return initial;
}
export function edge(id: string, to: string, extra: Partial<Edge> = {}): Edge {
  return { id, fromZoneId: zoneA.id, toZoneId: to, directionality: "bilateral", movementRules: [], visibilityRule: "visible", shape: "straight", interactionTags: [], ...extra };
}
function Harness() {
  const movement = useActorKeyboardMovement();
  return <><p data-testid="movement-hud">{movement.summary}</p><svg>{movement.overlay}</svg>{movement.dialog}<ActorHealthKeyboard /></>;
}
export function setup(initial = encounter(), ids = ["alpha", "bravo"]) {
  resetAppStore(); store.dispatch(loadEncounterState(initial));
  store.dispatch(setActiveTool("actor")); store.dispatch(selectEntity({ entityType: "actor", ids }));
  return render(<Provider store={store}><InterfacePreferenceProvider><CombatPreferenceProvider><KeybindProvider><ZoneResizeApprovalProvider><Harness /></ZoneResizeApprovalProvider></KeybindProvider></CombatPreferenceProvider></InterfacePreferenceProvider></Provider>);
}
