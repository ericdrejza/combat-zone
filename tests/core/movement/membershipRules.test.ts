import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { membershipCandidates, resolveMembership } from '@core/movement/zoneMembership';
import { reconcileMembership } from '@core/movement/reconcileMembership';
import { DEFAULT_CANVAS_PREFERENCES, saveCanvasPreferences, CANVAS_PREFERENCES_KEY } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { subscribeMembershipChoices } from '@ui/membership/membershipChoices';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
const rect = (left: number, top: number, right: number, bottom: number) => [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
function fixture() {
  let state = createZone(createEncounterState({ id: 'membership', name: 'Membership' }), { id: 'left', polygon: rect(0, 0, 128, 256) });
  state = createZone(state, { id: 'right', polygon: rect(128, 0, 256, 256) });
  state = createActor(state, { id: 'actor', currentZoneId: 'left', size: 'xLarge' });
  state.movementRules.zoneLocked = false;
  return state;
}
afterEach(() => localStorage.removeItem(CANVAS_PREFERENCES_KEY));
describe('configurable Zone membership', () => {
  it('distinguishes center, footprint overlap, and anchor-cell membership', () => {
    const state = fixture(), actor = state.actors.byId.actor, point = { x: 96, y: 160 };
    expect(membershipCandidates(state, actor, point, DEFAULT_CANVAS_PREFERENCES)).toEqual(['left']);
    expect(membershipCandidates(state, actor, point, { ...DEFAULT_CANVAS_PREFERENCES, membership: 'overlap' })).toEqual(['left', 'right']);
    state.movementRules.snapToGrid = true;
    expect(membershipCandidates(state, actor, point, { ...DEFAULT_CANVAS_PREFERENCES, membership: 'cells' })).toEqual(['left', 'right']);
  });
  it('uses the selected fallback without snapping', () => {
    const state = fixture(), actor = state.actors.byId.actor;
    expect(membershipCandidates(state, actor, { x: 96, y: 160 }, { ...DEFAULT_CANVAS_PREFERENCES, membership: 'cells', fallback: 'center' })).toEqual(['left']);
    expect(membershipCandidates(state, actor, { x: 96, y: 160 }, { ...DEFAULT_CANVAS_PREFERENCES, membership: 'cells', fallback: 'overlap' })).toEqual(['left', 'right']);
  });
  it('narrows by shared cells, passes ties, and keeps current only among candidates', () => {
    const state = fixture(); state.movementRules.snapToGrid = true;
    expect(resolveMembership(state, state.actors.byId.actor, { x: 96, y: 160 }, { ...DEFAULT_CANVAS_PREFERENCES, membership: 'cells' })).toBe('left');
    expect(resolveMembership(state, state.actors.byId.actor, { x: 128, y: 128 }, { ...DEFAULT_CANVAS_PREFERENCES, membership: 'overlap', deciders: ['nearest', 'current', 'cells', 'ask'] })).toBe('left');
  });
  it('supports Ask Me fallback and a final unresolved choice', async () => {
    const state = fixture(); state.actors.byId.actor.currentZoneId = 'zoneless';
    state.actors.byId.actor.spatialPosition = { x: 128, y: 128 };
    saveCanvasPreferences({ ...DEFAULT_CANVAS_PREFERENCES, membership: 'overlap', deciders: ['ask', 'nearest', 'current', 'cells'] });
    const requests: boolean[] = [];
    const unsubscribe = subscribeMembershipChoices(request => { requests.push(request.hasFallback); request.resolve(request.hasFallback ? 'fallback' : 'right'); });
    try {
      const next = await reconcileMembership(state, state, createEncounterActionRecord('movement.updateRules'));
      expect(requests).toEqual([true, false]); expect(next?.actors.byId.actor.currentZoneId).toBe('right');
      expect(state.actors.byId.actor.currentZoneId).toBe('zoneless');
    } finally { unsubscribe(); }
  });
  it('cancels the entire pending change without mutating the source', async () => {
    const state = fixture(); state.actors.byId.actor.spatialPosition = { x: 128, y: 128 };
    saveCanvasPreferences({ ...DEFAULT_CANVAS_PREFERENCES, membership: 'overlap', deciders: ['ask', 'nearest', 'current', 'cells'] });
    const unsubscribe = subscribeMembershipChoices(request => request.resolve(null));
    try { expect(await reconcileMembership(state, state, createEncounterActionRecord('movement.updateRules'))).toBeNull(); expect(state.actors.byId.actor.currentZoneId).toBe('left'); }
    finally { unsubscribe(); }
  });
});
