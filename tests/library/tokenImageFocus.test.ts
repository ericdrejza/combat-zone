import { configureStore } from "@reduxjs/toolkit";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { createActor, updateActorProperties } from "@entities/actor/actorMutations";
import { replaceEncounterLibraryAssetReferences } from "@library/libraryReferences";
import libraryReducer, { createLink, replaceImage, resolveLibraryAsset, setTokenImageFocus, uploadImage } from "@library/librarySlice";
import encounterReducer, { commitEncounterChange, loadEncounterState, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { persistenceWriteGuardMiddleware, setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";

const focus = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
const asset = { name: "Token", mediaType: "image/png", source: { kind: "url" as const, url: "https://example.com/token.png" } };
function fixture() {
  const upload = uploadImage({ sectionId: "tokens", parentId: "tokens-root", asset });
  let library = libraryReducer(undefined, upload);
  const link = createLink({ sectionId: "tokens", parentId: "tokens-root", targetId: upload.payload.id });
  library = libraryReducer(library, link);
  const encounter = createActor(createEncounterState({ id: "focus", name: "Focus" }), {
    id: "a", currentZoneId: "zoneless", image: { ...asset, libraryNodeId: upload.payload.id }
  });
  return { library, encounter, id: upload.payload.id, linkId: link.payload.id };
}

it("shares the original asset's default across links without mutating existing actors", () => {
  const { library, encounter, id, linkId } = fixture();
  const changed = libraryReducer(library, setTokenImageFocus({ sectionId: "tokens", nodeId: linkId, focus }));
  expect(resolveLibraryAsset(changed.sections.tokens, id)?.imageFocus).toEqual(focus);
  expect(resolveLibraryAsset(changed.sections.tokens, linkId)).toBe(resolveLibraryAsset(changed.sections.tokens, id));
  expect(encounter.actors.byId.a.imageFocus).toBeUndefined();
  const next = createActor(encounter, { id: "b", currentZoneId: "zoneless", image: resolveLibraryAsset(changed.sections.tokens, linkId)! });
  expect(next.actors.byId.b.imageFocus).toEqual(focus);
  expect(next.actors.byId.a).toEqual(encounter.actors.byId.a);
  expect(libraryReducer(changed, setTokenImageFocus({ sectionId: "tokens", nodeId: id, focus }))).toBe(changed);
});

it("applies and resets actor framing as atomic undoable snapshots, without changing the Library", () => {
  const { library, encounter } = fixture();
  let history = encounterReducer(undefined, loadEncounterState(encounter));
  const custom = updateActorProperties(encounter, "a", { imageFocus: focus });
  history = encounterReducer(history, commitEncounterChange({ action: createEncounterActionRecord("actor.updateProperties"), nextEncounter: custom }));
  expect(history.present.actors.byId.a.imageFocus).toEqual(focus);
  expect(encounterReducer(history, undoEncounterChange()).present).toEqual(encounter);
  expect(encounterReducer(encounterReducer(history, undoEncounterChange()), redoEncounterChange()).present).toEqual(custom);
  const reset = updateActorProperties(custom, "a", { imageFocus: null });
  history = encounterReducer(history, commitEncounterChange({ action: createEncounterActionRecord("actor.updateProperties"), nextEncounter: reset }));
  expect(history.present.actors.byId.a.imageFocus).toBeUndefined();
  expect(encounterReducer(history, undoEncounterChange()).present).toEqual(custom);
  expect(resolveLibraryAsset(library.sections.tokens, library.sections.tokens.nodesById["tokens-root"].childIds![0])?.imageFocus).toBeUndefined();
});

it("clears framing on source replacement and restores the previous image and framing on undo", () => {
  const { library, encounter, id } = fixture();
  const current = updateActorProperties(encounter, "a", { imageFocus: focus });
  const replacement = { ...asset, source: { kind: "url" as const, url: "https://example.com/new.png" } };
  const next = replaceEncounterLibraryAssetReferences(current, library.sections.tokens, id, replacement);
  expect(next.actors.byId.a.imageFocus).toBeUndefined();
  expect(next.actors.byId.a.image).toEqual(replacement.source);
  const history = encounterReducer(encounterReducer(undefined, loadEncounterState(current)), commitEncounterChange({ action: createEncounterActionRecord("library.asset.changeSource"), nextEncounter: next }));
  expect(encounterReducer(history, undoEncounterChange()).present).toEqual(current);
  const focusedLibrary = libraryReducer(library, setTokenImageFocus({ sectionId: "tokens", nodeId: id, focus }));
  const replaced = libraryReducer(focusedLibrary, replaceImage({ sectionId: "tokens", nodeId: id, asset: replacement }));
  expect(resolveLibraryAsset(replaced.sections.tokens, id)?.imageFocus).toBeUndefined();
  expect(updateActorProperties(current, "a", { image: replacement.source }).actors.byId.a.imageFocus).toBeUndefined();
  expect(updateActorProperties(current, "a", { image: { ...asset.source } }).actors.byId.a.imageFocus).toEqual(focus);
});

it.each(["STRICT", "ADVISORY"] as const)("respects %s validation for actor focus changes", mode => {
  const current = fixture().encounter; current.validationState.mode = mode;
  current.actors.byId.a.currentZoneId = "missing-zone";
  const prepared = prepareValidatedEncounterChange({ currentEncounter: current,
    nextEncounter: updateActorProperties(current, "a", { imageFocus: focus }),
    action: createEncounterActionRecord("actor.updateProperties", { actorId: "a" }) });
  expect(prepared.blocked).toBe(mode === "STRICT");
  expect(prepared.validationResult.messages).toContainEqual(expect.objectContaining({ code: "zoneIntegrity.actorZoneMissing" }));
});

it("blocks direct Library focus dispatches in read-only workspaces", () => {
  const { library, id } = fixture();
  const store = configureStore({ reducer: libraryReducer, preloadedState: library, middleware: get => get().concat(persistenceWriteGuardMiddleware) });
  setPersistenceWritable(false);
  try {
    store.dispatch(setTokenImageFocus({ sectionId: "tokens", nodeId: id, focus }));
    expect(store.getState()).toBe(library);
  } finally { setPersistenceWritable(true); }
});
