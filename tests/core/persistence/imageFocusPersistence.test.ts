import { CLOUD_RECORD_SCHEMA_VERSION, validateEncounter, validateLibrary } from "@combat-zone/firebase-api";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { ENCOUNTER_SCHEMA_VERSION } from "@core/encounter/types";
import { assertEncounterState, assertLibraryState, migrateEncounterState, parseExportEnvelope } from "@core/persistence/envelope";
import { InMemoryWorkspaceRepository } from "@core/persistence/memoryRepository";
import { EXPORT_SCHEMA_VERSION } from "@core/persistence/types";
import { createActor, updateActorProperties } from "@entities/actor/actorMutations";
import libraryReducer, { uploadImage } from "@library/librarySlice";

const focus = { x: 0.25, y: 0.125, width: 0.5, height: 0.5 };
const image = { imageFocus: focus, name: "Token", mediaType: "image/png", source: { kind: "url" as const, url: "https://example.com/token.png" } };
const state = () => createActor(createEncounterState({ id: "focus", name: "Focus" }), { id: "a", currentZoneId: "zoneless", image });
const library = () => libraryReducer(undefined, uploadImage({ sectionId: "tokens", parentId: "tokens-root", asset: image }));
const cloud = (value: unknown) => ({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: "focus", folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(value)) });

it("round trips actor snapshots and Library defaults independently through saves and exports", async () => {
  const original = state(), lib = library();
  const custom = updateActorProperties(original, "a", { imageFocus: { ...focus, x: 0.4 } });
  const repo = new InMemoryWorkspaceRepository();
  const record = await repo.createEncounter(original);
  await repo.saveLibrary(lib);
  await repo.saveEncounter(custom, { expectedRevision: record.revision });
  expect((await repo.getEncounter("focus"))?.state).toEqual(custom);
  expect((await repo.getLibrary()).state).toEqual(lib);
  const envelope = { kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: custom, library: lib };
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(JSON.parse(JSON.stringify(envelope)));
  expect(validateEncounter(cloud(custom)).state).toEqual(JSON.parse(JSON.stringify(custom)));
  expect(validateLibrary({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, assetIds: [], state: lib }).state).toEqual(lib);
  await expect(repo.saveEncounter(original, { expectedRevision: record.revision })).rejects.toThrow(/revision/i);
  expect((await repo.getEncounter("focus"))?.state).toEqual(custom);
});

it("migrates schema 31 without creating framing or changing legacy artwork", () => {
  const current = state(); delete current.actors.byId.a.imageFocus;
  const old = { ...current, schemaVersion: 31 }, before = structuredClone(old);
  expect(migrateEncounterState(old)).toEqual({ ...current, schemaVersion: ENCOUNTER_SCHEMA_VERSION });
  expect(old).toEqual(before);
  expect(() => assertEncounterState({ ...current, schemaVersion: ENCOUNTER_SCHEMA_VERSION + 1 })).toThrow(/unsupported/);
});

it.each([null, { ...focus, width: -1 }, { ...focus, x: 1 }, { ...focus, y: Infinity }])("rejects invalid focus at local and cloud boundaries: %j", invalid => {
  const encounter = state(); Object.assign(encounter.actors.byId.a, { imageFocus: invalid });
  expect(() => assertEncounterState(encounter)).toThrow(/imageFocus/);
  expect(() => validateEncounter(cloud(encounter))).toThrow(/imageFocus/);
  const lib = structuredClone(library()); const node = Object.values(lib.sections.tokens.nodesById).find(node => node.asset)!;
  Object.assign(node.asset!, { imageFocus: invalid });
  expect(() => assertLibraryState(lib)).toThrow(/focus/);
  expect(() => validateLibrary({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, assetIds: [], state: lib })).toThrow(/imageFocus/);
});

it("preserves the last saved encounter after an invalid crop write", async () => {
  const repo = new InMemoryWorkspaceRepository(), original = state();
  const record = await repo.createEncounter(original);
  const invalid = structuredClone(original); invalid.actors.byId.a.imageFocus!.x = 2;
  await expect(repo.saveEncounter(invalid, { expectedRevision: record.revision })).rejects.toThrow(/imageFocus/);
  expect((await repo.getEncounter("focus"))?.state).toEqual(original);
});
