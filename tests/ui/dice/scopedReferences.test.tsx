import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { scopedReferenceEncounter } from "@tests/core/dice/fixtures";
import { LogPanel } from "@ui/panels/LogPanel";
import { evaluateDice } from "@core/dice/evaluate";
import { rollFormulas } from "@core/dice/workerClient";
import { setActiveTool } from "@interaction/interactionState";
vi.mock("@core/dice/workerClient", () => ({ rollFormulas: vi.fn(async (formulas: string[]) => formulas.map(formula => evaluateDice(formula, () => .5))) }));
beforeEach(() => { setPersistenceWritable(true); vi.clearAllMocks(); store.dispatch(loadEncounterState(scopedReferenceEncounter())); });
function setup() {
  render(<Provider store={store}><LogPanel /></Provider>);
  return screen.getByRole('textbox', { name: 'Chat message' }) as HTMLTextAreaElement;
}
function type(input: HTMLTextAreaElement, value: string) {
  fireEvent.change(input, { target: { value } }); input.focus(); input.setSelectionRange(value.length, value.length); fireEvent.select(input);
}
function last() { const messages = store.getState().encounter.present.chatMessages; return messages.byId[messages.allIds.at(-1)!]; }

it('completes the active scoped list item and stops after an Actor leaf', async () => {
  const input = setup(); const user = userEvent.setup();
  type(input, '@Zone1.[heroes,enemies].["Hero Two", Gua');
  expect(screen.queryByRole('option', { name: /^Scout/ })).not.toBeInTheDocument();
  await user.keyboard('{Tab}');
  expect(input).toHaveValue('@Zone1.[heroes,enemies].["Hero Two", Guard');
  await user.keyboard('].');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
});
it('sends nested selector lists as one target scope with deduplicated actor identities', async () => {
  const input = setup(); type(input, '@Zone1.heroes."Goblin Chief"/Slash -> [@Zone1.[heroes,enemies].["Hero Two",Guard], @Zone1.enemies]');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => expect(last()?.invocation?.targets.map(target => target.id)).toEqual(['d', 'b']));
  expect(last().references?.filter(reference => reference.kind === 'actor').map(reference => reference.entityId)).toEqual(['a', 'd', 'b']);
});
it('blocks an invalid scoped entry before rolling and keeps the entire draft', () => {
  const input = setup(); const text = '@"Goblin Chief"/Slash -> @Zone1.heroes.["Hero Two",Guard]';
  type(input, text); fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Guard');
  expect(rollFormulas).not.toHaveBeenCalled(); expect(last()).toBeUndefined(); expect(input).toHaveValue(text);
});
it('uses a selected duplicate-name Actor within a scoped list', () => {
  const state = scopedReferenceEncounter(); state.actors.byId.d.name = 'Guard';
  store.dispatch(loadEncounterState(state));
  const input = setup(); type(input, '@Zone1.[heroes,enemies].[Gu');
  const choices = screen.getAllByRole('option', { name: /^Guard/ });
  fireEvent.click(choices[1]);
  const completed = input.value + ']'; type(input, completed);
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(last().references?.filter(reference => reference.kind === 'actor').map(reference => reference.entityId)).toEqual(['b']);
});
it('offers root-list union suggestions and sends plain complex references without requiring dice notation', () => {
  const input = setup(); type(input, '@[Zone1,Zone2].heroes.');
  expect(screen.getByRole('option', { name: /^Scout/ })).toBeInTheDocument();
  type(input, 'Hello @[Zone1,Zone2].heroes.["Hero Two",Scout]');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(last().rolls).toBeUndefined();
  expect(last().references?.filter(reference => reference.kind === 'actor').map(reference => reference.entityId)).toEqual(['d', 'c']);
});
it('requires a direct faction/entity choice and honors the selected faction when sending', () => {
  const state = scopedReferenceEncounter(); state.actors.byId.d.name = 'heroes';
  store.dispatch(loadEncounterState(state));
  store.dispatch(setActiveTool('select'));
  const input = setup(); type(input, '@heroes');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  const choices = screen.getByRole('group', { name: 'Resolve ambiguous mention' });
  expect(last()).toBeUndefined();
  fireEvent.click(within(choices).getByRole('button', { name: /heroes.*Faction/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(last().message).toBe('@heroes');
  fireEvent.click(screen.getByRole('button', { name: '@heroes' }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'c', 'd']);
});
