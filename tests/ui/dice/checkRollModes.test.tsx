import { createActor } from "@entities/actor/actorMutations";
import userEvent from "@testing-library/user-event";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, expect, it, vi } from "vitest";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { evaluateDice } from "@core/dice/evaluate";
import { rollFormulas } from "@core/dice/workerClient";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { LogPanel } from "@ui/panels/LogPanel";
import type { CheckRollSetting } from "@core/dice/types";
vi.mock("@core/dice/workerClient", () => ({ rollFormulas: vi.fn() }));
const mockRoll = vi.mocked(rollFormulas);
const message = '@"Goblin Chief"/Slash -> [@Guard, @Scout]';
function last() { const messages = store.getState().encounter.present.chatMessages; return messages.byId[messages.allIds.at(-1)!]; }
function setup(mode: CheckRollSetting, text = message, targetCount = 0) {
  let state = diceEncounter();
  for (let index = 0; index < targetCount; index++) state = createActor(state, { id: `target${index}`, name: `Target${index}`, currentZoneId: "zoneless" }); state.actors.byId.a.rollables!.byId.slash.checkRollMode = mode;
  store.dispatch(loadEncounterState(state)); render(<Provider store={store}><LogPanel /></Provider>);
  fireEvent.change(screen.getByRole('textbox', { name: 'Chat message' }), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
}
beforeEach(() => {
  setPersistenceWritable(true); mockRoll.mockReset();
  mockRoll.mockImplementation(async formulas => formulas.map((formula, index) => evaluateDice(formula, () => index ? .1 : .5)));
});
it('focuses Success on opening so Enter resolves a successful single-target check', async () => {
  const user = userEvent.setup();
  setup('shared', '@"Goblin Chief"/Slash -> @Guard');
  const dialog = await screen.findByRole('dialog', { name: 'Check result: 16' });
  expect(within(dialog).getByRole('button', { name: 'Success' })).toHaveFocus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(last().invocation?.phase).toBe('resolved'));
  expect(last().invocation?.decisions).toEqual({ b: 'hit' });
  expect(last().rolls?.map(result => result.role)).toEqual(['check', 'effect']);
});
it.each(['shared', 'perTarget'] as const)('focuses the first Success button for %s checks, including on reopening', async mode => {
  setup(mode);
  const dialog = await screen.findByRole('dialog', { name: mode === 'shared' ? 'Check result: 16' : 'Check results' });
  expect(within(dialog).getAllByRole('button', { name: 'Success' })[0]).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Resolve Success / Failure' }));
  expect(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Success' })[0]).toHaveFocus();
  expect(last().invocation?.decisions).toEqual({});
});
it('rolls per target, resumes partial decisions, and applies a single effect to successful targets', async () => {
  setup('perTarget');
  let dialog = await screen.findByRole('dialog', { name: 'Check results' });
  expect(mockRoll.mock.calls[0][0]).toEqual(['d20+5', 'd20+5']);
  expect(last().rolls?.map(result => [result.targetId, result.node.value])).toEqual([['b', 16], ['c', 8]]);
  fireEvent.click(within(dialog).getAllByRole('button', { name: 'Success' })[0]);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByText('· Success')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resolve Success / Failure' }));
  dialog = screen.getByRole('dialog', { name: 'Check results' });
  expect(within(dialog).getAllByRole('button', { name: 'Success' })[0]).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(within(dialog).getAllByRole('button', { name: 'Failure' })[1]);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve targets' }));
  await waitFor(() => expect(last().invocation?.phase).toBe('resolved'));
  expect(last().rolls?.map(result => result.role)).toEqual(['check', 'check', 'effect']);
  expect(screen.getByText('· Success')).toBeInTheDocument(); expect(screen.getByText('· Failure')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }));
  const apply = screen.getByRole('dialog', { name: 'Apply Damage' });
  expect(within(apply).getByRole('checkbox', { name: 'Guard' })).toBeChecked();
  expect(within(apply).getByRole('checkbox', { name: 'Scout' })).not.toBeChecked();
});
it.each(['shared', 'perTarget'] as const)('Ask me chooses %s without publishing or rolling before selection', async mode => {
  setup('ask');
  const prompt = await screen.findByRole('dialog', { name: 'Check roll' });
  expect(mockRoll).not.toHaveBeenCalled(); expect(last()).toBeUndefined();
  fireEvent.click(within(prompt).getByRole('button', { name: mode === 'shared' ? 'One check for all targets' : 'One check per target' }));
  await waitFor(() => expect(last()?.invocation?.checkRollMode).toBe(mode));
  expect(last().rolls).toHaveLength(mode === 'shared' ? 1 : 2);
  expect(last().invocation?.rollable.checkRollMode).toBe('ask');
});
it('cancels Ask me without changing the draft, launching audio, or sending', async () => {
  const audio = vi.fn(); window.addEventListener('combat-zone:audio-trigger', audio);
  try {
    setup('ask'); const prompt = await screen.findByRole('dialog', { name: 'Check roll' });
    fireEvent.click(within(prompt).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Chat message' })).toBeEnabled());
    expect(screen.getByRole('textbox', { name: 'Chat message' })).toHaveValue(message);
    expect(last()).toBeUndefined(); expect(mockRoll).not.toHaveBeenCalled(); expect(audio).not.toHaveBeenCalled();
  } finally { window.removeEventListener('combat-zone:audio-trigger', audio); }
});
it.each(['', ' -> @Guard'])('skips Ask me for zero or one target (%s)', async target => {
  setup('ask', '@"Goblin Chief"/Slash' + target);
  await screen.findByRole('dialog', { name: 'Check result: 16' });
  expect(last().rolls).toHaveLength(1); expect(last().invocation?.checkRollMode).toBe('shared');
  expect(screen.queryByRole('dialog', { name: 'Check roll' })).not.toBeInTheDocument();
});
it('aborts an open choice when the encounter session changes', async () => {
  setup('ask'); await screen.findByRole('dialog', { name: 'Check roll' });
  act(() => store.dispatch(loadEncounterState(diceEncounter())));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Check roll' })).not.toBeInTheDocument());
  expect(mockRoll).not.toHaveBeenCalled(); expect(last()).toBeUndefined();
});
it.each([['Success', 'Success'], ['Failure', 'Failure'], ['Mixed', 'Mixed']] as const)('shows shared %s after resolution', async (outcome, expected) => {
  setup('shared'); const dialog = await screen.findByRole('dialog', { name: 'Check result: 16' });
  fireEvent.click(within(dialog).getAllByRole('button', { name: outcome === 'Failure' ? 'Failure' : 'Success' })[0]);
  fireEvent.click(within(dialog).getAllByRole('button', { name: outcome === 'Success' ? 'Success' : 'Failure' })[1]);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve targets' }));
  await waitFor(() => expect(last().invocation?.phase).toBe('resolved'));
  expect(screen.getByText(`· ${expected}`)).toBeInTheDocument();
  expect(mockRoll).toHaveBeenCalledTimes(outcome === 'Failure' ? 1 : 2);
});
it('publishes no partial per-target results on engine failure and preserves the draft', async () => {
  mockRoll.mockRejectedValue(new Error('Roll exceeded its time budget.'));
  setup('perTarget'); await screen.findByRole('alert');
  expect(last()).toBeUndefined(); expect(screen.getByRole('textbox', { name: 'Chat message' })).toHaveValue(message);
});
it('rerolls against the current check mode and asks again when configured', async () => {
  setup('shared'); const dialog = await screen.findByRole('dialog', { name: 'Check result: 16' });
  fireEvent.keyDown(dialog, { key: 'Escape' });
  const state = structuredClone(store.getState().encounter.present);
  state.actors.byId.a.rollables!.byId.slash.checkRollMode = 'ask';
  act(() => store.dispatch(loadEncounterState(state)));
  fireEvent.click(screen.getByRole('button', { name: 'Roll again' }));
  const prompt = await screen.findByRole('dialog', { name: 'Check roll' });
  expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(1);
  fireEvent.click(within(prompt).getByRole('button', { name: 'One check per target' }));
  await waitFor(() => expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(2));
  expect(last().invocation?.checkRollMode).toBe('perTarget'); expect(last().rolls).toHaveLength(2);
});
it('does not publish after writer access is lost while choosing', async () => {
  setup('ask'); const dialog = await screen.findByRole('dialog', { name: 'Check roll' });
  try {
    setPersistenceWritable(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'One check per target' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockRoll).not.toHaveBeenCalled(); expect(last()).toBeUndefined();
  } finally { setPersistenceWritable(true); }
});

it('rejects 21 per-target checks before rolling, retaining the entire draft', async () => {
  const text = '@"Goblin Chief"/Slash -> [' + Array.from({ length: 21 }, (_, index) => `@Target${index}`).join(', ') + ']';
  setup('perTarget', text, 21);
  expect(await screen.findByRole('alert')).toHaveTextContent('20 targets');
  expect(mockRoll).not.toHaveBeenCalled(); expect(last()).toBeUndefined();
  expect(screen.getByRole('textbox', { name: 'Chat message' })).toHaveValue(text);
});
