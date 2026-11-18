import { Provider } from "react-redux";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { evaluateDice } from "@core/dice/evaluate";
import { rollFormulas } from "@core/dice/workerClient";
import { LogPanel } from "@ui/panels/LogPanel";
import { saveDicePresentation } from "@ui/dice/dicePreferences";
vi.mock("@core/dice/workerClient", () => ({ rollFormulas: vi.fn() }));
const roll = vi.mocked(rollFormulas);
beforeEach(() => {
  setPersistenceWritable(true); saveDicePresentation('text'); store.dispatch(loadEncounterState(diceEncounter()));
  roll.mockImplementation(async formulas => formulas.map((f, i) => evaluateDice(f, () => i / formulas.length)));
});
afterEach(() => { setPersistenceWritable(true); vi.clearAllMocks(); });
function setup() { render(<Provider store={store}><LogPanel /></Provider>); }
function send(message: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Chat message' }), { target: { value: message } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
}
function messages() { const c = store.getState().encounter.present.chatMessages; return c.allIds.map(id => c.byId[id]); }
it('rolls /rr as one atomic message with independent results and fresh IDs when rolled again', async () => {
  setup(); send('/rr (d6+4) 3');
  await waitFor(() => expect(messages()[0]?.rolls).toHaveLength(3));
  expect(messages()[0].rolls!.map(r => r.node.value)).toEqual([5, 7, 9]);
  const first = structuredClone(messages()[0]);
  expect(new Set(first.rolls!.map(r => r.id)).size).toBe(3);
  fireEvent.click(screen.getByRole('button', { name: 'Roll again' }));
  await waitFor(() => expect(messages()).toHaveLength(2));
  expect(messages()[0]).toEqual(first);
  expect(messages()[1].rolls).toHaveLength(3);
  expect(messages()[1].rolls!.every(r => !first.rolls!.some(old => old.id === r.id))).toBe(true);
  expect(store.getState().encounter.past).toHaveLength(0);
});
it('retains invalid repeated-roll drafts without starting the worker', () => {
  setup(); send('/rr d6 21');
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Chat message' })).toHaveValue('/rr d6 21');
  expect(messages()).toHaveLength(0); expect(roll).not.toHaveBeenCalled();
});
it('uses current referenced definitions without changing prior results or applications', async () => {
  const state = diceEncounter(); state.actors.byId.a.rollables!.byId.slash.checkFormula = '';
  store.dispatch(loadEncounterState(state)); setup(); send('@"Goblin Chief"/Slash -> @Guard');
  await waitFor(() => expect(messages()).toHaveLength(1));
  const first = structuredClone(messages()[0]);
  const current = structuredClone(store.getState().encounter.present);
  current.actors.byId.a.rollables!.byId.slash.effectFormula = 'd4+9';
  current.actors.byId.a.rollables!.byId.slash.effectKind = 'healing';
  current.actors.byId.b.hitPoints!.current = 17;
  current.rollApplications = { allIds: ['receipt'], byId: { receipt: { id: 'receipt', resultId: first.rolls![0].id, actorId: 'b', kind: 'damage', amount: 3 } } };
  act(() => store.dispatch(loadEncounterState(current)));
  fireEvent.click(screen.getByRole('button', { name: 'Roll again' }));
  await waitFor(() => expect(messages()).toHaveLength(2));
  expect(messages()[1].rolls![0].formula).toBe('d4+9');
  expect(messages()[1].invocation!.rollable.effectKind).toBe('healing');
  expect(messages()[0]).toEqual(first);
  expect(store.getState().encounter.present.rollApplications).toEqual(current.rollApplications);
  expect(store.getState().encounter.present.actors.byId.b.hitPoints!.current).toBe(17);
});
it('places Damage before Healing and offers roll-again only for rolled messages', async () => {
  setup(); send('Hello'); expect(screen.queryByRole('button', { name: 'Roll again' })).not.toBeInTheDocument();
  send('/r d6'); await screen.findByRole('region', { name: 'Roll result: d6' });
  const buttons = within(screen.getByRole('region', { name: 'Roll result: d6' })).getAllByRole('button');
  expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['Apply Damage', 'Apply Healing']);
});
it('blocks roll-again at the writer boundary even before disabled controls rerender', async () => {
  setup(); send('/r d6'); await waitFor(() => expect(messages()).toHaveLength(1));
  setPersistenceWritable(false);
  fireEvent.click(screen.getByRole('button', { name: 'Roll again' }));
  expect(messages()).toHaveLength(1); expect(roll).toHaveBeenCalledTimes(1);
});

it('reports current missing references without changing the old card', async () => {
  const state = diceEncounter(); state.actors.byId.a.rollables!.byId.slash.checkFormula = '';
  store.dispatch(loadEncounterState(state)); setup(); send('@"Goblin Chief"/Slash -> @Guard');
  await waitFor(() => expect(messages()).toHaveLength(1));
  const old = structuredClone(messages()[0]);
  const current = structuredClone(store.getState().encounter.present);
  delete current.actors.byId.b; current.actors.allIds = current.actors.allIds.filter(id => id !== 'b');
  act(() => store.dispatch(loadEncounterState(current)));
  fireEvent.click(screen.getByRole('button', { name: 'Roll again' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No matching');
  expect(messages()).toEqual([old]);
});
