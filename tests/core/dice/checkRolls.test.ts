import { createZone } from "@entities/zone/zoneMutations";
import { expect, it } from "vitest";
import { checkOutcome, checkRollSetup } from "@core/dice/checkRolls";
import { resolveInvocation } from "@core/dice/resolveInvocation";
import { evaluateDice } from "@core/dice/evaluate";
import { diceEncounter } from "./fixtures";

function invocation() { return resolveInvocation(diceEncounter(), '@"Goblin Chief"/Slash -> [@Guard, @Scout]'); }
it('creates independent checks for deduplicated targets, preserving shared and untargeted defaults', () => {
  const value = invocation(); value.rollable.checkRollMode = 'perTarget';
  expect(checkRollSetup(value)).toEqual({ mode: 'perTarget', formulas: ['d20+5', 'd20+5'] });
  value.rollable.checkRollMode = 'ask';
  expect(checkRollSetup(value, 'shared')).toEqual({ mode: 'shared', formulas: ['d20+5'] });
  expect(checkRollSetup(value, 'perTarget').formulas).toHaveLength(2);
  const dedup = resolveInvocation(diceEncounter(), '@"Goblin Chief"/Slash -> [@Guard, @Guard]');
  dedup.rollable.checkRollMode = 'perTarget'; expect(checkRollSetup(dedup).mode).toBe('shared');
  value.targets = []; expect(checkRollSetup(value, 'perTarget').formulas).toHaveLength(1);
});
it('allows 20 independent checks, rejects 21, and permits a shared check for the same group', () => {
  const value = invocation(); value.rollable.checkRollMode = 'perTarget';
  value.targets = Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: String(index) }));
  expect(checkRollSetup(value).formulas).toHaveLength(20);
  value.targets.push({ id: '20', name: '20' });
  expect(() => checkRollSetup(value)).toThrow(/20 targets/);
  expect(checkRollSetup(value, 'shared').formulas).toHaveLength(1);
  value.rollable.checkFormula = ''; expect(checkRollSetup(value).formulas).toEqual(['2d6+3']);
});
it.each([
  [{ b: 'hit', c: 'hit' }, 'Success'], [{ b: 'miss', c: 'miss' }, 'Failure'], [{ b: 'hit', c: 'miss' }, 'Mixed'],
] as const)('summarizes resolved shared checks (%j)', (decisions, expected) => {
  const value = invocation(); value.decisions = { ...decisions }; value.phase = 'resolved';
  const result = evaluateDice('16'); result.role = 'check';
  expect(checkOutcome(value, result)).toBe(expected);
  expect(checkOutcome(value, { ...result, targetId: 'b' })).toBe(decisions.b === 'hit' ? 'Success' : 'Failure');
  expect(checkOutcome({ ...value, phase: 'pending' }, result)).toBeUndefined();
  expect(checkOutcome(value, { ...result, role: 'effect' })).toBeUndefined();
});
it('supports the untargeted decision without adding an outcome to unresolved historical checks', () => {
  const value = invocation(); value.targets = []; value.phase = 'resolved';
  const result = { ...evaluateDice('16'), role: 'check' as const };
  expect(checkOutcome(value, result)).toBeUndefined();
  value.decisions = { untargeted: 'miss' }; expect(checkOutcome(value, result)).toBe('Failure');
});

it('expands Zone factions once and deduplicates overlapping explicit targets', () => {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Arena', polygon: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }] });
  for (const id of ['b', 'c']) { state.actors.byId[id].currentZoneId = 'z'; state.actors.byId[id].layoutGroup = 'enemy'; }
  state.actors.byId.a.rollables!.byId.slash.checkRollMode = 'perTarget';
  const value = resolveInvocation(state, '@"Goblin Chief"/Slash -> [@Arena.enemies, @Guard]');
  expect(value.targets.map(target => target.id)).toEqual(['b', 'c']); expect(checkRollSetup(value).formulas).toHaveLength(2);
});
