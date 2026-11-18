import { expect, it } from "vitest";
import { scopedReferenceEncounter } from "./fixtures";
import { createActor } from "@entities/actor/actorMutations";
import { chatSuggestions } from "@core/dice/chatSuggestions";
import { resolveEntityReference } from "@core/dice/references";
import { resolveInvocation } from "@core/dice/resolveInvocation";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { factionSelectors } from "@core/dice/factionSelectors";
import { messageBindings } from "@core/dice/messageBindings";
import type { ChatMessage } from "@core/chat/types";

it('offers populated factions directly and scopes Actor suggestions to their members across zones', () => {
  const state = scopedReferenceEncounter();
  expect(chatSuggestions(state, '@her').some(choice => choice.kind === 'faction' && choice.name === 'heroes')).toBe(true);
  expect(chatSuggestions(state, '@').filter(choice => choice.kind === 'faction').map(choice => choice.name)).toEqual(['heroes', 'enemies']);
  expect(chatSuggestions(state, '@heroes.').map(choice => choice.name)).toEqual(['Goblin Chief', 'Scout', 'Hero Two']);
  expect(chatSuggestions(state, '@enemies.').map(choice => choice.name)).toEqual(['Guard']);
  expect(chatSuggestions(state, '@heroes."Hero Two".')).toEqual([]);
});
it('includes Zoneless members in direct faction scope without changing the scoped Zone membership', () => {
  let state = scopedReferenceEncounter();
  state = createActor(state, { id: 'e', name: 'Unplaced Hero', currentZoneId: 'zoneless' }); state.actors.byId.e.layoutGroup = 'hero';
  expect(resolveEntityReference(state, '@heroes', 'target:0').actorIds).toEqual(['a', 'c', 'd', 'e']);
  expect(resolveEntityReference(state, '@Zone1.heroes', 'target:0').actorIds).toEqual(['a', 'd']);
});
it('resolves direct faction lists and scoped actor paths as targets and single-actor sources', () => {
  const state = scopedReferenceEncounter();
  expect(resolveInvocation(state, '@heroes."Goblin Chief"/Slash -> @[heroes,enemies]').targets.map(target => target.id)).toEqual(['a', 'c', 'd', 'b']);
  expect(() => resolveInvocation(state, '@heroes/Slash')).toThrow(/one actor/i);
  expect(() => resolveInvocation(state, '@"Goblin Chief"/Slash -> @heroes.["Hero Two",Guard]')).toThrow(/Guard/);
});
it('creates faction controls for direct, ordinary scoped, and scoped list references', () => {
  const state = scopedReferenceEncounter();
  for (const text of ['@heroes', '@Zone1.heroes', '@Zone1.[heroes,enemies]']) {
    const selectors = factionSelectors(state, text, snapshotReferences(state, text));
    expect(selectors.map(selector => selector.actorIds)).toEqual(text === '@heroes' ? [['a', 'c', 'd']] : text.includes('[') ? [['a', 'd'], ['b']] : [['a', 'd']]);
  }
});
it('requires a root choice when a faction shares a name with an Actor/Zone and retains that choice on replay', () => {
  const state = scopedReferenceEncounter(); state.actors.byId.d.name = 'heroes'; state.zones.byId.z2.name = 'heroes';
  expect(() => resolveEntityReference(state, '@heroes', 'source')).toThrow(/Choose/);
  const options = chatSuggestions(state, '@heroes');
  const faction = options.find(option => option.kind === 'faction')!.binding!;
  const bindings = { [faction.key]: faction.id };
  expect(resolveEntityReference(state, '@heroes', 'source', bindings).actorIds).toEqual(['a', 'c', 'd']);
  const entry: ChatMessage = { id: 'm', timestamp: 1, sender: { id: 'game-master', name: 'GM', color: null }, message: '@heroes', references: snapshotReferences(state, '@heroes', bindings) };
  expect(resolveEntityReference(state, entry.message, 'source', messageBindings(entry)).actorIds).toEqual(['a', 'c', 'd']);
  for (const kind of ['actor', 'zone'] as const) {
    const choice = options.find(option => option.kind === kind)!.binding!;
    expect(resolveEntityReference(state, '@heroes', 'source', { [choice.key]: choice.id }).kind).toBe(kind);
  }
});
