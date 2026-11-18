import { expect, it } from "vitest";
import { parseReferencePath, referenceBindingKey, referenceTokens } from "@core/dice/referencePath";
import { splitReference } from "@core/dice/referenceSyntax";
import { referenceScopeChildren, rootReferenceScope } from "@core/dice/referenceScopes";
import { diceEncounter } from "./fixtures";
import { createZone } from "@entities/zone/zoneMutations";

it('keeps flat selector list items and quoted names as distinct offset-bearing path segments', () => {
  const text = '@Courtyard.[heroes, enemies].["Hero One", Guard]';
  const path = parseReferencePath(text);
  expect(path.map(segment => segment.items.map(item => item.name))).toEqual([['Courtyard'], ['heroes', 'enemies'], ['Hero One', 'Guard']]);
  for (const segment of path) for (const item of segment.items) expect(text.slice(item.start, item.end)).toBe(item.raw);
});
it('does not split target lists on commas inside a scoped reference', () => {
  expect(splitReference('@Courtyard.[heroes,enemies].[A,B], @Other', ',')).toEqual(['@Courtyard.[heroes,enemies].[A,B]', ' @Other']);
  const message = '@Source/Attack -> [@Courtyard.[heroes,enemies].[A,B], @Other]';
  expect(referenceBindingKey(message, message.indexOf('@Other'))).toBe('target:1');
});
it('scans references containing list spaces and stops at outer list delimiters', () => {
  const message = 'Hi @Courtyard.[heroes, enemies].["Hero One", Guard], and @Scout.';
  expect(referenceTokens(message).map(token => token.text)).toEqual(['@Courtyard.[heroes, enemies].["Hero One", Guard]', '@Scout']);
  expect(referenceTokens('@Courtyard.heroes.', true)[0].text).toBe('@Courtyard.heroes.');
});
it('derives faction and actor children from their current scope and stops at Actor leaves', () => {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Courtyard', polygon: [] });
  state.actors.byId.b.currentZoneId = 'z'; state.actors.byId.b.layoutGroup = 'enemy';
  const zone = rootReferenceScope(state).find(node => node.kind === 'zone' && node.name === 'Courtyard')!;
  const enemies = referenceScopeChildren(state, [zone]).find(node => node.name === 'enemies')!;
  expect(referenceScopeChildren(state, [enemies]).map(node => node.name)).toEqual(['Guard']);
  const guard = referenceScopeChildren(state, [enemies])[0];
  expect(referenceScopeChildren(state, [guard])).toEqual([]);
});
