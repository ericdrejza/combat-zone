import { Provider } from "react-redux";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { store } from "@store/store";
import { loadEncounterState, sendChatMessage, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { act } from "@testing-library/react";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { evaluateDice } from "@core/dice/evaluate";
import { LogPanel } from "@ui/panels/LogPanel";
const token = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
beforeEach(() => {
  setPersistenceWritable(true);
  const state = diceEncounter();
  state.actors.byId.a.layoutGroup = 'neutral';
  state.actors.byId.b.layoutGroup = 'enemy'; delete state.actors.byId.b.hitPoints;
  state.actors.byId.c.layoutGroup = 'hero'; state.actors.byId.c.image = { kind: 'embedded', dataUrl: token };
  store.dispatch(loadEncounterState(state));
  store.dispatch(sendChatMessage({ id: 'roll', timestamp: 1, sender: { id: 'gm', name: 'GM', color: null }, message: '/r 8', rolls: [evaluateDice('8')] }));
});
function setup(kind = 'Damage') {
  render(<Provider store={store}><LogPanel /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: `Apply ${kind}` }));
  return screen.getByRole('dialog', { name: `Apply ${kind}` });
}
it.each(['Damage', 'Healing'])('uses a grouping toggle and token selections in the %s dialog', kind => {
  const dialog = setup(kind); const group = within(dialog).getByRole('button', { name: 'Group by faction' });
  expect(group).toHaveAttribute('aria-pressed', 'true');
  expect(within(dialog).getAllByRole('checkbox').map(el => el.getAttribute('aria-label'))).toEqual(['Scout', 'Guard', 'Goblin Chief']);
  expect(within(dialog).getByRole('img', { name: 'Scout token' }).querySelector('image')).toHaveAttribute('href', token);
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Scout' }));
  expect(within(dialog).getByRole('checkbox', { name: 'Scout' })).toBeChecked();
  fireEvent.click(group);
  expect(group).toHaveAttribute('aria-pressed', 'false');
  expect(within(dialog).getAllByRole('checkbox').map(el => el.getAttribute('aria-label'))).toEqual(['Goblin Chief', 'Guard', 'Scout']);
  expect(within(dialog).getByRole('checkbox', { name: 'Scout' })).toBeChecked();
});
it('uses disabled actor tiles and a tooltip rather than static missing-HP text', () => {
  const dialog = setup(); const actor = within(dialog).getByRole('checkbox', { name: 'Guard' });
  expect(actor).toBeDisabled(); expect(actor).toHaveAttribute('title', 'No hit points configured');
  expect(within(dialog).queryByText('No hit points configured')).not.toBeInTheDocument();
  fireEvent.click(actor); expect(actor).not.toBeChecked();
  expect(within(dialog).getByRole('button', { name: 'Apply Damage' })).toBeDisabled();
});
it('preserves amount drafts across regrouping and applies them with undo/redo', async () => {
  const dialog = setup();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Scout' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Edit amount for Scout' }));
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Amount for Scout' }), { target: { value: '5' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Group by faction' }));
  expect(within(dialog).getByRole('spinbutton', { name: 'Amount for Scout' })).toHaveValue(5);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply Damage' }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.c.hitPoints!.current).toBe(15));
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.actors.byId.c.hitPoints!.current).toBe(20);
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present.actors.byId.c.hitPoints!.current).toBe(15);
});
it('allows selecting token tiles with the keyboard', async () => {
  const user = userEvent.setup(); const dialog = setup();
  within(dialog).getByRole('checkbox', { name: 'Scout' }).focus();
  await user.keyboard(' ');
  expect(within(dialog).getByRole('checkbox', { name: 'Scout' })).toBeChecked();
});

it('marks only actors with a receipt for this result and clears the marker on undo', async () => {
  const dialog = setup();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Scout' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply Damage' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText('Applied to 1 target')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply Damage' }));
  const again = screen.getByRole('dialog', { name: 'Apply Damage' });
  const scout = within(again).getByRole('checkbox', { name: 'Scout' });
  expect(within(scout).getByLabelText('This actor has already applied this effect')).toBeInTheDocument();
  expect(within(within(again).getByRole('checkbox', { name: 'Goblin Chief' })).queryByLabelText('This actor has already applied this effect')).not.toBeInTheDocument();
  act(() => store.dispatch(undoEncounterChange()));
  expect(screen.queryByText('Applied to 1 target')).not.toBeInTheDocument();
  expect(within(scout).queryByLabelText('This actor has already applied this effect')).not.toBeInTheDocument();
});
it('increments, decrements, halves and doubles a draft, retaining it when editing closes', () => {
  const dialog = setup();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Scout' }));
  const edit = within(dialog).getByRole('button', { name: 'Edit amount for Scout' });
  fireEvent.click(edit);
  const input = within(dialog).getByRole('spinbutton', { name: 'Amount for Scout' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Increase amount for Scout' })); expect(input).toHaveValue(9);
  fireEvent.click(within(dialog).getByRole('button', { name: '/2' })); expect(input).toHaveValue(4);
  fireEvent.click(within(dialog).getByRole('button', { name: '×2' })); expect(input).toHaveValue(8);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Decrease amount for Scout' })); expect(input).toHaveValue(7);
  fireEvent.click(edit); expect(input).not.toBeInTheDocument();
  fireEvent.click(edit); expect(within(dialog).getByRole('spinbutton', { name: 'Amount for Scout' })).toHaveValue(7);
});
