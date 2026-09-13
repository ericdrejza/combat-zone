import { describe, expect, it } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { getEncounterLoadTool } from "@core/encounter/encounterToolSelection";

function createEncounterWithCounts(zoneCount: number, actorCount: number) {
  const encounter = createEncounterState({
    id: "tool-selection-test",
    name: "Tool selection test"
  });
  encounter.zones.allIds = Array.from({ length: zoneCount }, (_, index) => `zone-${index}`);
  encounter.actors.allIds = Array.from({ length: actorCount }, (_, index) => `actor-${index}`);
  return encounter;
}

describe("getEncounterLoadTool", () => {
  it.each([
    [0, 0],
    [1, 4]
  ])("selects Zone for %i zones and %i actors", (zoneCount, actorCount) => {
    expect(getEncounterLoadTool(createEncounterWithCounts(zoneCount, actorCount))).toBe("zone");
  });

  it.each([
    [2, 0],
    [4, 1]
  ])("selects Actor for %i zones and %i actors", (zoneCount, actorCount) => {
    expect(getEncounterLoadTool(createEncounterWithCounts(zoneCount, actorCount))).toBe("actor");
  });

  it("selects Select when an encounter has multiple zones and actors", () => {
    expect(getEncounterLoadTool(createEncounterWithCounts(2, 2))).toBe("select");
  });
});
