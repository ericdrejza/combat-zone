import { describe, it, expect } from "vitest";
import { diceEncounter, slash } from "./fixtures";
import { applyRollResult, saveRollables } from "@entities/actor/rollableMutations";
import { DEFAULT_COMBAT_RULES } from "@entities/actor/actorResources";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { ActorResourceValidator } from "@entities/actor/actorResourceValidator";

describe("dice mutations retain the encounter validation boundary", () => {
  it.each(["STRICT", "ADVISORY"] as const)("handles an existing actor resource error in %s", mode => {
    const state = diceEncounter(); state.validationState.mode = mode;
    // A malformed resource elsewhere is a genuine existing validator failure.
    state.actors.byId.c.hitPoints!.maximum = 0;
    for (const [type, next] of [
      ["actor.editRollables", saveRollables(state, "a", [{ ...slash, name: "Edited" }])],
      ["actor.adjustRollHitPoints", applyRollResult(state, [{ id: "r", resultId: "roll", actorId: "b", amount: 2, kind: "damage" }], DEFAULT_COMBAT_RULES)]
    ] as const) {
      const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord(type), validators: [ActorResourceValidator] });
      expect(prepared.validationResult.valid).toBe(false); expect(prepared.blocked).toBe(mode === "STRICT");
    }
  });
});
