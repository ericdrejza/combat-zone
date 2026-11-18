import { createZone } from "@entities/zone/zoneMutations";
import { expect, it } from "vitest";
import { messageFormulas } from "@core/dice/messageFormulas";
import { messageBindings } from "@core/dice/messageBindings";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { resolveInvocation } from "@core/dice/resolveInvocation";
import type { ChatMessage } from "@core/chat/types";
import { diceEncounter } from "./fixtures";
it.each(['/rr d6+4 3', '/rr (d6+4) 3', '/RR (d6 + 4) 3'])('extracts independent repeat formulas from %s', command => {
  const formulas = messageFormulas(command);
  expect(formulas).toHaveLength(3);
  expect(new Set(formulas).size).toBe(1);
  expect(formulas[0]).toContain('d6');
});
it.each(['/rr d6', '/rr d6 0', '/rr d6 -1', '/rr d6 2.5', '/rr d6 21', '/rr d6 Infinity', '/rr d6 many', '/rr 3'])('rejects invalid repeat arguments: %s', command => {
  expect(() => messageFormulas(command)).toThrow(/1 to 20/);
});
it('validates the entire formula before creating a repeat batch and accepts its boundaries', () => {
  expect(() => messageFormulas('/rr (d6 garbage) 3')).toThrow();
  expect(messageFormulas('/rr d6 1')).toEqual(['d6']);
  expect(messageFormulas('/rr d6 20')).toHaveLength(20);
});
it('reuses explicit duplicate choices while resolving the current Rollable definition', () => {
  const state = diceEncounter(); state.actors.byId.c.name = 'Guard';
  const text = '@"Goblin Chief"/Slash -> @Guard';
  const bindings = { 'target:0': 'c' };
  const original: ChatMessage = { id: 'm', timestamp: 1, sender: { id: 'gm', name: 'GM', color: null }, message: text,
    invocation: resolveInvocation(state, text, bindings), references: snapshotReferences(state, text, bindings) };
  state.actors.byId.a.rollables!.byId.slash.effectFormula = 'd4+9';
  const repeated = resolveInvocation(state, original.message, messageBindings(original));
  expect(repeated.rollable.effectFormula).toBe('d4+9');
  expect(repeated.targets.map(t => t.id)).toEqual(['c']);
  expect(original.invocation!.rollable.effectFormula).toBe('2d6+3');
});

it('resolves current zone membership when a zone-targeted message is rolled again', () => {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Courtyard', polygon: [] });
  state.actors.byId.b.currentZoneId = 'z'; state.actors.byId.b.layoutGroup = 'enemy';
  state.actors.byId.c.layoutGroup = 'enemy';
  const text = '@"Goblin Chief"/Slash -> @Courtyard.enemies';
  const message: ChatMessage = { id: 'm', timestamp: 1, message: text, sender: { id: 'gm', name: 'GM', color: null },
    invocation: resolveInvocation(state, text), references: snapshotReferences(state, text) };
  state.actors.byId.b.currentZoneId = 'zoneless'; state.actors.byId.c.currentZoneId = 'z';
  expect(resolveInvocation(state, text, messageBindings(message)).targets.map(t => t.id)).toEqual(['c']);
  expect(message.invocation!.targets.map(t => t.id)).toEqual(['b']);
});
