import { createEncounterState } from "@core/encounter/createEncounterState";
import { ENCOUNTER_SCHEMA_VERSION } from "@core/encounter/types";
import { assertEncounterState, migrateEncounterState } from "@core/persistence/envelope";
import { hydrateEncounterRecord, hydrateRecoveryDraft } from "@core/persistence/hydratePersistedRecords";
import { parseExportEnvelope, EXPORT_SCHEMA_VERSION } from "@core/persistence";
import { createEmptyLibraryState } from "@core/persistence/memoryRepository";
import { createActor } from "@entities/actor/actorMutations";
import { updateActorStatus } from "@entities/actor/actorStatus";

function state() { return createActor(createEncounterState({ id: "status", name: "Status" }), { id: "a", currentZoneId: "zoneless" }); }

describe("persisted actor statuses", () => {
  it.each([0, 1, 2, 3] as const)("round trips ordinal %s losslessly", (status) => {
    const encounter = updateActorStatus(state(), "a", status);
    const envelope = { kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter, library: createEmptyLibraryState() };
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
  });
  it("migrates legacy actors as healthy without changing source records", () => {
    const legacy = { ...state(), schemaVersion: 11 };
    delete legacy.actors.byId.a.status;
    const before = structuredClone(legacy);
    const migrated = hydrateEncounterRecord({ id: "status", state: legacy, revision: 0, createdAt: 1, updatedAt: 1, folderId: null } as never);
    expect(migrated.state.actors.byId.a.status).toBe(3);
    expect(migrated.state.schemaVersion).toBe(ENCOUNTER_SCHEMA_VERSION);
    expect(hydrateRecoveryDraft({ state: legacy, updatedAt: 1 } as never).state).toEqual(migrated.state);
    expect(legacy).toEqual(before);
  });
  it.each([-1, 4, 1.5, "dead", null])("rejects invalid status %s without changing valid data", (status) => {
    const current = state();
    const invalid = structuredClone(current);
    (invalid.actors.byId.a as unknown as { status: unknown }).status = status;
    expect(() => assertEncounterState(migrateEncounterState(invalid))).toThrow(/status is invalid/);
    expect(current.actors.byId.a.status).toBe(3);
  });
});
