import { expect, it } from "vitest";
import { chatSuggestions } from "@core/dice/chatSuggestions";
import { resolveEntityReference } from "@core/dice/references";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { suggestionSuffix } from "@core/dice/suggestionMatching";
import { scopedReferenceEncounter } from "./fixtures";

it('suggests compact unquoted names at each scope without loosening sent reference resolution', () => {
  const state = scopedReferenceEncounter();
  state.actors.byId.a.name = 'Hero 1';
  state.zones.byId.z1.name = 'Zone One';
  for (const draft of ['@hero1', '@"Zone One".hero1', '@"Zone One".heroes.hero1', '@[hero1']) {
    const choice = chatSuggestions(state, draft).find(c => c.name === 'Hero 1');
    expect(choice?.text).toBe(draft === '@hero1' ? '@"Hero 1"' : '"Hero 1"');
  }
  expect(chatSuggestions(state, '@zoneone')[0].text).toBe('@"Zone One"');
  expect(chatSuggestions(state, '@"hero1')).toEqual([]);
  expect(chatSuggestions(state, "@'hero1")).toEqual([]);
  expect(() => resolveEntityReference(state, '@hero1', 'source')).toThrow(/No matching/);
  expect(snapshotReferences(state, 'Hello @hero1')).toEqual([]);
  expect(resolveEntityReference(state, '@"Hero 1"', 'source').actorIds).toEqual(['a']);
});

it('ranks compact prefixes before substrings and preserves actual single-word matches', () => {
  const state = scopedReferenceEncounter();
  state.actors.byId.a.name = 'Other Hero 1';
  state.actors.byId.b.name = 'Hero 1';
  state.actors.byId.c.name = 'Hero1';
  expect(chatSuggestions(state, '@hero1').map(c => c.name)).toEqual(['Hero 1', 'Hero1', 'Other Hero 1']);
  expect(resolveEntityReference(state, '@hero1', 'source').actorIds).toEqual(['c']);
});

it('uses compact matching for Rollables while retaining quote-sensitive matching', () => {
  const state = scopedReferenceEncounter();
  state.actors.byId.a.rollables!.byId.slash.name = 'Heavy Strike';
  expect(chatSuggestions(state, '@"Goblin Chief"/heavystr')[0].text).toBe('"Heavy Strike"');
  expect(chatSuggestions(state, '@"Goblin Chief"/"heavystr')).toEqual([]);
});

it('maps compact prefixes to the correct remaining original characters', () => {
  expect(suggestionSuffix('Hero 12', 'hero1', true)).toBe('2');
  expect(suggestionSuffix('Hero 12', 'hero', true)).toBe(' 12');
  expect(suggestionSuffix('Hero 12', 'her', true)).toBe('o 12');
  expect(suggestionSuffix('Hero 12', 'hero1')).toBeNull();
  expect(suggestionSuffix('Hero 12', 'hero2', true)).toBeNull();
});
