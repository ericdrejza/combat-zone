import { expect, it } from "vitest";
import { canvasReferencePick } from "@core/dice/canvasReferencePick";
import { resolveInvocation } from "@core/dice/resolveInvocation";
import { chatSuggestions } from "@core/dice/chatSuggestions";
import { diceEncounter } from "./fixtures";

it('prioritizes the current combat actor, then selected actors, only for a bare reference', () => {
  const state = diceEncounter();
  state.initiativeTracker = { entries: [{ actorId: 'b' }, { actorId: 'c' }], currentActorId: 'b', currentRound: 1 };
  const names = (draft: string) => chatSuggestions(state, draft, draft.length, undefined, ['c']).map(c => c.name);
  expect(names('@')).toEqual(['Guard', 'Scout', 'Goblin Chief', 'neutrals']);
  expect(names('Hello @')).toEqual(['Guard', 'Scout', 'Goblin Chief', 'neutrals']);
  expect(names('@G')).toEqual(['Goblin Chief', 'Guard']);
  expect(names('@o')).toEqual(['Goblin Chief', 'Scout']);
  state.initiativeTracker.currentRound = null;
  expect(names('@')).toEqual(['Scout', 'Goblin Chief', 'Guard', 'neutrals']);
});
it('fills a bare reference while preserving the surrounding prompt', () => {
  const state = diceEncounter();
  expect(canvasReferencePick(state, 'Hello @, welcome', 7, 'actor', 'a')).toMatchObject({ text: 'Hello @"Goblin Chief", welcome', bindings: { 'mention:6': 'a' } });
  expect(canvasReferencePick(state, '@Gu', 3, 'actor', 'b')).toBeNull();
  expect(canvasReferencePick(state, 'hello', 5, 'actor', 'b')).toBeNull();
});
it('expands engagement participants into a target list with exact identities, including duplicate names', () => {
  const state = diceEncounter();
  state.actors.byId.c.name = 'Guard';
  state.engagements = { allIds: ['e'], byId: { e: { id: 'e', participantIds: ['b', 'c'], parentZoneId: 'z', layoutOrientation: 'LEFT_RIGHT', layoutStrategy: 'FLEX' } } };
  const draft = '@"Goblin Chief"/Slash -> @';
  const pick = canvasReferencePick(state, draft, draft.length, 'engagement', 'e')!;
  expect(pick.text).toBe('@"Goblin Chief"/Slash -> [@Guard, @Guard]');
  expect(resolveInvocation(state, pick.text, pick.bindings).targets.map(t => t.id)).toEqual(['b', 'c']);
  const list = '@"Goblin Chief"/Slash -> [@Guard, @]';
  const nested = canvasReferencePick(state, list, list.length - 1, 'engagement', 'e')!;
  expect(nested.text).toBe('@"Goblin Chief"/Slash -> [@Guard, @Guard, @Guard]');
  expect(nested.bindings).toEqual({ 'target:1': 'b', 'target:2': 'c' });
});
