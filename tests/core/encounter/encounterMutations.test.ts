import { createEncounterState } from "@core/encounter/createEncounterState";
import { renameEncounter } from "@core/encounter/encounterMutations";

describe("encounter mutations", () => {
  it("trims and applies a non-empty encounter name", () => {
    const encounter = createEncounterState({ id: "encounter", name: "Old" });

    expect(renameEncounter(encounter, "  New name  ")).toEqual({
      ...encounter,
      name: "New name"
    });
  });

  it("keeps the same snapshot for empty or unchanged names", () => {
    const encounter = createEncounterState({ id: "encounter", name: "Name" });

    expect(renameEncounter(encounter, "   ")).toBe(encounter);
    expect(renameEncounter(encounter, " Name ")).toBe(encounter);
  });
});
