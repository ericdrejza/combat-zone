import { Provider } from "react-redux";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { createZone } from "@entities/zone/zoneMutations";
import { ChatComposer } from "@ui/panels/ChatComposer";

beforeEach(() => {
  setPersistenceWritable(true);
  const state = createZone(diceEncounter(), { id: 'z', name: 'Great Hall', polygon: [] });
  state.engagements = { allIds: ['e'], byId: { e: { id: 'e', participantIds: ['b', 'c'], parentZoneId: 'z', layoutOrientation: 'LEFT_RIGHT', layoutStrategy: 'FLEX' } } };
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('select'));
});
function setup() {
  render(<Provider store={store}><ChatComposer /><svg aria-label="SVG encounter workspace">
    {(['actor', 'zone', 'engagement'] as const).map((kind, i) => <rect key={kind} role="button" aria-label={`Pick ${kind}`} data-entity-type={kind} data-entity-id={['b', 'z', 'e'][i]}
      onClick={() => store.dispatch(selectEntity({ entityType: kind, ids: [['b', 'z', 'e'][i]], userInitiated: true }))} />)}
  </svg></Provider>);
  return screen.getByRole('textbox', { name: 'Chat message' });
}
it.each([['actor', '@Guard'], ['zone', '@"Great Hall"'], ['engagement', '[@Guard, @Scout]']])('fills %s references after canvas selection and returns focus to chat', async (kind, expected) => {
  const input = setup();
  fireEvent.change(input, { target: { value: '@' } });
  fireEvent.click(screen.getByRole('button', { name: `Pick ${kind}` }));
  expect(input).toHaveValue(expected);
  await waitFor(() => expect(input).toHaveFocus());
  expect(store.getState().encounter.past).toHaveLength(0);
  expect(store.getState().interaction.selection.selectedEntityType).toBe(kind);
});
it('allows picking an already selected actor without replacing typed reference text later', () => {
  store.dispatch(selectEntity({ entityType: 'actor', ids: ['b'] }));
  const input = setup(); fireEvent.change(input, { target: { value: '@' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pick actor' })); expect(input).toHaveValue('@Guard');
  fireEvent.change(input, { target: { value: '@Gu' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pick actor' })); expect(input).toHaveValue('@Gu');
});
it('respects the active tool selection contract', () => {
  store.dispatch(setActiveTool('zone'));
  const input = setup(); fireEvent.change(input, { target: { value: '@' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pick actor' })); expect(input).toHaveValue('@');
  fireEvent.click(screen.getByRole('button', { name: 'Pick zone' })); expect(input).toHaveValue('@"Great Hall"');
});

it('orders an empty mention by the active combat actor and selected actors, then returns to name matching', () => {
  const state = diceEncounter();
  state.initiativeTracker = { entries: [{ actorId: 'b' }, { actorId: 'c' }], currentActorId: 'b', currentRound: 1 };
  store.dispatch(loadEncounterState(state)); store.dispatch(selectEntity({ entityType: 'actor', ids: ['c'] }));
  const input = setup(); fireEvent.change(input, { target: { value: '@' } });
  expect(screen.getAllByRole('option').map(option => option.getAttribute('aria-label'))).toEqual(['Guard (Actor)', 'Scout (Actor)', 'Goblin Chief (Actor)', 'neutrals (Faction)']);
  fireEvent.change(input, { target: { value: '@G' } });
  expect(screen.getAllByRole('option').map(option => option.getAttribute('aria-label'))).toEqual(['Goblin Chief (Actor)', 'Guard (Actor)']);
});
