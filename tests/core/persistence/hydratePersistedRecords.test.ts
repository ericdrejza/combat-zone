import { createEncounterState } from "@core/encounter/createEncounterState";
import { ENCOUNTER_SCHEMA_VERSION } from "@core/encounter/types";
import {
  hydrateEncounterRecord,
  hydrateLibraryRecord,
  hydrateManifest,
  hydrateRecoveryDraft
} from "@core/persistence/hydratePersistedRecords";
import { createEmptyLibraryState } from "@core/persistence/memoryRepository";
import { WORKSPACE_SCHEMA_VERSION } from "@core/persistence/types";
import { createAudioCue, createAudioCueGroup } from "@entities/audio/audioMutations";

describe("persisted record hydration", () => {
  it.each([true, false])("migrates schema-9 cue behavior without losing subsettings (repeat=%s)", (repeat) => {
    const encounter = createAudioCue(createAudioCueGroup(createEncounterState({ id: "audio", name: "Audio" }), { id: "zone", section: "zone" }), {
      id: "effect", libraryNodeId: "sound", placement: { type: "group", groupId: "zone" }, type: "effect", repeat,
      triggers: ["zone_enter"], repeatDelay: { minimumDelaySeconds: 5, maximumDelaySeconds: 10 }
    });
    const state = { ...encounter, schemaVersion: 9 } as unknown as Record<string, unknown>;
    delete (state.audioCues as { byId: Record<string, Record<string, unknown>> }).byId.effect.triggersEnabled;
    const before = structuredClone(state);
    const record = { createdAt: 1, folderId: null, id: "audio", revision: 0, state, updatedAt: 1 };
    const migrated = hydrateEncounterRecord(record as never);
    expect(migrated.state.schemaVersion).toBe(11);
    expect(migrated.state.audioCues.byId.effect).toMatchObject({ repeat, triggersEnabled: !repeat, triggers: ["zone_enter"], repeatDelay: { minimumDelaySeconds: 5, maximumDelaySeconds: 10 } });
    expect(hydrateRecoveryDraft({ state, updatedAt: 1 } as never).state).toEqual(migrated.state);
    expect(state).toEqual(before);
  });

  it("validates fresh records using the explicitly versioned cue-group schema", () => {
    const state = createEncounterState({ id: "fresh", name: "Fresh" });
    const record = { createdAt: 1, folderId: null, id: state.id, revision: 0, state, updatedAt: 1 };
    expect(ENCOUNTER_SCHEMA_VERSION).toBe(11);
    expect(hydrateEncounterRecord(record)).toEqual(record);
    expect(hydrateRecoveryDraft({ state, updatedAt: 1 }).state).toEqual(state);
    expect(state.audioCueGroups).toEqual({ allIds: [], byId: {} });
  });

  it("rejects development-only schema-8 records without mutating their saved data", () => {
    const state = { ...createEncounterState({ id: "old", name: "Old" }), schemaVersion: 8 };
    const before = structuredClone(state);
    const record = { createdAt: 1, folderId: null, id: state.id, revision: 0, state, updatedAt: 1 };
    expect(() => hydrateEncounterRecord(record as never)).toThrow(/schemaVersion 8 is unsupported/);
    expect(state).toEqual(before);
  });

  it("migrates legacy encounter records and recovery drafts before use", () => {
    const legacyState = createEncounterState({ id: "legacy", name: "Legacy" }) as unknown as Record<string, unknown>;
    legacyState.schemaVersion = 7;
    delete legacyState.audioCues;
    const panelLayout = legacyState.panelLayout as { right: unknown[] };
    panelLayout.right = panelLayout.right.filter((panel) => (panel as { id: string }).id !== "audio");
    const record = {
      createdAt: 1,
      folderId: null,
      id: "legacy",
      revision: 2,
      state: legacyState,
      updatedAt: 3
    };

    const encounter = hydrateEncounterRecord(record as never);
    const recovery = hydrateRecoveryDraft({ state: legacyState, updatedAt: 3 } as never);

    expect(encounter.state.audioCues).toEqual({ allIds: [], byId: {} });
    expect(encounter.state.panelLayout.right.at(-1)?.id).toBe("audio");
    expect(recovery.state.audioCues).toEqual({ allIds: [], byId: {} });
  });

  it("migrates the legacy Library and manifest schemas", () => {
    const legacyLibrary = createEmptyLibraryState() as unknown as {
      sections: Record<string, unknown>;
    };
    delete legacyLibrary.sections.audio;

    const library = hydrateLibraryRecord({ revision: 1, state: legacyLibrary, updatedAt: 2 } as never);
    const manifest = hydrateManifest({
      activeEncounterId: "legacy",
      revision: 1,
      schemaVersion: 2,
      updatedAt: 2
    } as never);

    expect(library.state.sections.audio.rootId).toBe("audio-root");
    expect(manifest.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
  });

  it("rejects a newer manifest schema", () => {
    expect(() => hydrateManifest({
      activeEncounterId: null,
      revision: 1,
      schemaVersion: 999,
      updatedAt: 2
    } as never)).toThrow(/unsupported schema version/i);
  });
});
