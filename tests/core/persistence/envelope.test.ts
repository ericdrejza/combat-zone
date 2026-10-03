import { createEncounterState } from "@core/encounter/createEncounterState";
import { DEFAULT_ENCOUNTER_PANEL_LAYOUT } from "@core/encounter/panelLayout";
import {
  EXPORT_SCHEMA_VERSION,
  PersistenceValidationError,
  parseExportEnvelope,
  validateExportEnvelope,
  type EncounterExportEnvelope
} from "@core/persistence";
import { createEmptyLibraryState } from "@core/persistence/memoryRepository";
import { createAudioCue, createAudioCueGroup } from "@entities/audio/audioMutations";

function encounter(id = "encounter-1") {
  return createEncounterState({ id, name: "Test encounter" });
}

function validEnvelope(): EncounterExportEnvelope {
  return {
    kind: "encounter-export",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: 1,
    encounter: encounter(),
    library: createEmptyLibraryState()
  };
}

describe("persistence export envelopes", () => {
  it("round trips muted cues and rejects volumes outside 0–100%", () => {
    const value = validEnvelope();
    value.encounter = createAudioCue(createAudioCueGroup(value.encounter, { id: "ambience", section: "ambiance" }), {
      id: "muted", libraryNodeId: "audio-node", placement: { type: "group", groupId: "ambience" }, type: "loop", volume: 0
    });
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(value)))).toEqual(value);
    for (const volume of [-0.1, 1.1]) {
      value.encounter.audioCues.byId.muted.volume = volume;
      expect(() => validateExportEnvelope(value)).toThrow(/audioCues/);
    }
  });
  it("accepts a current encounter envelope without changing EncounterState", () => {
    const value = validEnvelope();
    expect(validateExportEnvelope(value)).toEqual(value);
  });

  it("rejects unknown kinds and newer versions before data is used", () => {
    expect(() => validateExportEnvelope({ ...validEnvelope(), kind: "future" })).toThrow(PersistenceValidationError);
    expect(() => validateExportEnvelope({ ...validEnvelope(), schemaVersion: 999 })).toThrow(/unsupported/i);
    expect(() => validateExportEnvelope({ ...validEnvelope(), encounter: { ...encounter(), schemaVersion: 999 } })).toThrow(/schemaVersion/);
  });

  it("rejects normalized collections with mismatched IDs", () => {
    const value = validEnvelope();
    value.encounter.actors.allIds = ["missing-actor"];

    expect(() => validateExportEnvelope(value)).toThrow(/byId and allIds/);
  });

  it("rejects panel layouts with missing or duplicated panels", () => {
    const value = validEnvelope();
    value.encounter.panelLayout.right = [
      { id: "initiative", collapsed: false },
      { id: "initiative", collapsed: true }
    ];

    expect(() => validateExportEnvelope(value)).toThrow(/every panel exactly once/);
  });

  it("rejects device-local asset references in portable envelopes", () => {
    const value = validEnvelope();
    value.encounter.backgroundImage = {
      source: { kind: "local_asset", assetId: "a".repeat(64), byteLength: 10 },
      height: 10,
      mediaType: "image/png",
      name: "Map",
      width: 10
    };

    expect(() => validateExportEnvelope(value)).toThrow(/device-local asset/);
  });

  it("adds the default panel layout when migrating schema version 6", () => {
    const value = validEnvelope() as unknown as Record<string, unknown>;
    const legacyEncounter = value.encounter as Record<string, unknown>;
    legacyEncounter.schemaVersion = 6;
    delete legacyEncounter.panelLayout;

    const migrated = parseExportEnvelope(value) as EncounterExportEnvelope;
    expect(migrated.encounter.panelLayout).toEqual(
      DEFAULT_ENCOUNTER_PANEL_LAYOUT
    );
  });

  it("adds an empty audio collection and panel when migrating schema version 7", () => {
    const value = validEnvelope() as unknown as Record<string, unknown>;
    value.schemaVersion = 2;
    const legacyEncounter = value.encounter as Record<string, unknown>;
    legacyEncounter.schemaVersion = 7;
    delete legacyEncounter.audioCues;
    const panelLayout = legacyEncounter.panelLayout as { right: unknown[] };
    panelLayout.right = panelLayout.right.slice(0, -1);
    const library = value.library as { sections: Record<string, unknown> };
    delete library.sections.audio;

    const migrated = parseExportEnvelope(value) as EncounterExportEnvelope;

    expect(migrated.encounter.audioCues).toEqual({ byId: {}, allIds: [] });
    expect(migrated.encounter.audioCueGroups).toEqual({ byId: {}, allIds: [] });
    expect(migrated.encounter.panelLayout.right.at(-1)).toEqual({
      collapsed: false,
      id: "audio"
    });
    expect(migrated.library.sections.audio.rootId).toBe("audio-root");
  });

  it("rejects invalid cue ranges and dangling group placements", () => {
    const value = validEnvelope();
    value.encounter = createAudioCue(createAudioCueGroup(value.encounter, {
      id: "zone-group",
      section: "zone"
    }), {
      id: "invalid-cue",
      libraryNodeId: "audio-node",
      placement: { type: "group", groupId: "zone-group" },
      type: "one_shot"
    });
    value.encounter.audioCues.byId["invalid-cue"].placement = { type: "group", groupId: "missing-group" };

    expect(() => validateExportEnvelope(value)).toThrow(/invalid group placement/);

    value.encounter.audioCues.byId["invalid-cue"].placement = { type: "group", groupId: "zone-group" };
    value.encounter.audioCues.byId["invalid-cue"].repeatDelay.maximumDelaySeconds = 2;
    value.encounter.audioCues.byId["invalid-cue"].repeatDelay.minimumDelaySeconds = 3;
    expect(() => validateExportEnvelope(value)).toThrow(/audioCues/);
  });

  it("migrates legacy embedded and HTTP image strings losslessly", () => {
    const value = validEnvelope() as unknown as Record<string, unknown>;
    value.schemaVersion = 1;
    const legacyEncounter = value.encounter as Record<string, unknown>;
    legacyEncounter.schemaVersion = 5;
    legacyEncounter.backgroundImage = {
      dataUrl: "https://example.com/map.png",
      height: 10,
      mediaType: "image/png",
      name: "Map",
      width: 20
    };
    const actors = legacyEncounter.actors as { allIds: string[]; byId: Record<string, unknown> };
    actors.allIds.push("actor-1");
    actors.byId["actor-1"] = {
      id: "actor-1", name: "Actor", actorType: "creature", layoutGroup: "enemy",
      size: "medium", shape: "circle", image: "data:image/png;base64,AA==",
      currentZoneId: "zoneless", statusEffects: [], metadata: {}
    };

    const migrated = parseExportEnvelope(value) as EncounterExportEnvelope;
    expect(migrated.encounter.backgroundImage?.source).toEqual({ kind: "url", url: "https://example.com/map.png" });
    expect(migrated.encounter.actors.byId["actor-1"].image).toEqual({ kind: "embedded", dataUrl: "data:image/png;base64,AA==" });
    expect(migrated.encounter.panelLayout).toEqual(DEFAULT_ENCOUNTER_PANEL_LAYOUT);
    expect(migrated.encounter.id).toBe("encounter-1");
  });
});
