import { expect, it } from "vitest";
import { scopedReferenceEncounter as setup } from "./fixtures";
import { chatSuggestions } from "@core/dice/chatSuggestions";
import { resolveInvocation } from "@core/dice/resolveInvocation";
import { resolveReferenceScope } from "@core/dice/referenceScopeResolution";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { messageBindings } from "@core/dice/messageBindings";
import { referencePreviewActorIds } from "@core/dice/referencePreview";
import type { ChatMessage } from "@core/chat/types";
import { evaluateDice } from "@core/dice/evaluate";
import { assertEncounterState } from "@core/persistence/envelope";
import { InMemoryWorkspaceRepository } from "@core/persistence/memoryRepository";
import { CLOUD_RECORD_SCHEMA_VERSION, validateEncounter } from "@combat-zone/firebase-api";
const names = (text: string) => chatSuggestions(setup(), text).map(choice => choice.name);
it('narrows zone/faction/list scopes and stops after an Actor leaf', () => {
  expect(names('@Zone1.heroes.')).toEqual(['Goblin Chief', 'Hero Two']);
  expect(names('@Zone1.enemies.')).toEqual(['Guard']);
  expect(names('@Zone1.[heroes, enemies].')).toEqual(['Goblin Chief', 'Hero Two', 'Guard']);
  expect(names('@Zone1.[heroes, enemies].["Hero Two", G')).toEqual(['Goblin Chief', 'Guard']);
  expect(names('@Zone1.heroes."Hero Two".')).toEqual([]);
  expect(names('@Guard.')).toEqual([]);
});
it('unions root Zone lists and offers only populated faction/Actor choices in the union', () => {
  expect(names('@[Zone1, Zone2].heroes.')).toEqual(['Goblin Chief', 'Hero Two', 'Scout']);
  expect(names('@[Zone1, Zone2].').filter(name => ['heroes', 'enemies', 'allies', 'neutrals'].includes(name))).toEqual(['heroes', 'enemies']);
  expect(names('@[Zone1, Zone2].enemies.')).toEqual(['Guard']);
});
it('resolves actor lists from the union of selected factions, deduplicating overlap with other targets', () => {
  const state = setup();
  const invocation = resolveInvocation(state, '@"Goblin Chief"/Slash -> [@Zone1.[heroes,enemies].["Hero Two",Guard], @Zone1.enemies]');
  expect(invocation.targets.map(target => target.id)).toEqual(['d', 'b']);
  expect(resolveInvocation(state, '@"Goblin Chief"/Slash -> @[Zone1,Zone2].heroes').targets.map(target => target.id)).toEqual(['a', 'd', 'c']);
});
it('allows lists at root and leaf levels, and a scoped source only when it resolves to one Actor', () => {
  const state = setup();
  expect(resolveInvocation(state, '@Zone1.heroes.["Goblin Chief"]/Slash -> @[Guard,Scout]').targets.map(target => target.id)).toEqual(['b', 'c']);
  expect(() => resolveInvocation(state, '@Zone1.heroes/Slash')).toThrow(/one actor/i);
  expect(chatSuggestions(state, '@Zone1.heroes."Goblin Chief"/').map(choice => choice.name)).toEqual(['Slash']);
});
it('blocks invalid or out-of-scope list entries rather than publishing partial targets', () => {
  const state = setup();
  expect(() => resolveInvocation(state, '@"Goblin Chief"/Slash -> @Zone1.heroes.["Hero Two",Guard]')).toThrow(/Guard/);
  expect(() => resolveInvocation(state, '@"Goblin Chief"/Slash -> @Zone1.[heroes,allies]')).toThrow(/No matching targets/);
  expect(() => resolveInvocation(state, '@"Goblin Chief"/Slash -> @[Zone1,Missing].heroes')).toThrow(/Missing/);
});
it('retains per-item identities when duplicate actor names require explicit choices', () => {
  const state = setup(); state.actors.byId.d.name = 'Goblin Chief';
  const text = '@[Zone1,Zone2].heroes.["Goblin Chief",Scout]';
  expect(() => resolveReferenceScope(state, text, 'target:0')).toThrow(/Choose/);
  const bindings = { 'target:0:path:2:0': 'd' };
  expect(resolveReferenceScope(state, text, 'target:0', bindings).actorIds).toEqual(['d', 'c']);
  const references = snapshotReferences(state, text, { 'source:path:2:0': 'd' });
  const entry: ChatMessage = { id: 'm', timestamp: 0, sender: { id: 'game-master', name: 'GM', color: null }, message: text, references };
  expect(resolveReferenceScope(state, text, 'source', messageBindings(entry)).actorIds).toEqual(['d', 'c']);
  expect(references.map(ref => text.slice(ref.start, ref.end))).toEqual(['Zone1', 'Zone2', '"Goblin Chief"', 'Scout']);
});
it('previews a faction selector within the saved Zone identity after renaming', () => {
  const state = setup(); const text = '@Zone1.[heroes,enemies].["Hero Two",Guard]';
  const refs = snapshotReferences(state, text); state.zones.byId.z1.name = 'Renamed';
  const heroes = refs.find(ref => text.slice(ref.start, ref.end) === 'heroes')!;
  expect(referencePreviewActorIds(state, text, refs, heroes)).toEqual(['a', 'd']);
});
it('replaces the current list item without consuming adjacent items or closing brackets', () => {
  const state = setup(); const draft = '@Zone1.[heroes,enemies].["Hero Two", Gua, "Goblin Chief"]';
  const caret = draft.indexOf('Gua') + 3;
  const choice = chatSuggestions(state, draft, caret).find(choice => choice.name === 'Guard')!;
  expect(draft.slice(0, choice.start) + choice.text + draft.slice(choice.end)).toBe('@Zone1.[heroes,enemies].["Hero Two", Guard, "Goblin Chief"]');
});
it('round trips scoped snapshots and per-item identities through repository and cloud validation', async () => {
  const state = setup(); const text = '@Zone1.heroes."Goblin Chief"/Slash -> @[Zone1,Zone2].[heroes,enemies].["Hero Two",Guard,Scout]';
  const check = evaluateDice('d20+5', () => .5); check.role = 'check';
  state.chatMessages = { allIds: ['m'], byId: { m: { id: 'm', timestamp: 1, sender: { id: 'game-master', name: 'GM', color: null },
    message: text, references: snapshotReferences(state, text), invocation: resolveInvocation(state, text), rolls: [check] } } };
  assertEncounterState(state);
  expect(validateEncounter({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state: JSON.parse(JSON.stringify(state)) }).state).toEqual(state);
  const repo = new InMemoryWorkspaceRepository(); await repo.createEncounter(state); await repo.saveRecoveryDraft(state);
  expect((await repo.getEncounter(state.id))?.state).toEqual(state);
  expect((await repo.getRecoveryDraft())?.state).toEqual(state);
});
