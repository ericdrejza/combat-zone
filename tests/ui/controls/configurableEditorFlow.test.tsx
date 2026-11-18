import { fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { diceEncounter, slash } from "@tests/core/dice/fixtures";
import { ActorRollables } from "@ui/dice/ActorRollables";
import { CounterControls } from "@ui/panels/status_panel/CounterControls";

beforeEach(() => setPersistenceWritable(true));
describe.each(['Rollable', 'Counter', 'Clock'] as const)('%s shared configurable flow', kind => {
  const nameLabel = `${kind} name`;
  const selectionLabel = `${kind} to edit`;
  const addLabel = kind === 'Rollable' ? 'Add Rollable' : `Add ${kind.toLowerCase()}`;
  const editLabel = kind === 'Rollable' ? 'Edit Rollables' : `Edit ${kind.toLowerCase()}s`;
  const createLabel = kind === 'Rollable' ? 'Create new Rollable' : `Create new ${kind.toLowerCase()}`;
  function setup(empty = false) {
    const state = diceEncounter();
    state.actors.byId.a.rollables = { allIds: empty ? [] : ['first', 'second'], byId: empty ? {} : {
      first: { ...slash, id: 'first', name: 'Alpha' }, second: { ...slash, id: 'second', name: 'Beta' }
    } };
    store.dispatch(loadEncounterState(state));
    const counters = { allIds: empty ? [] : ['first', 'second'], byId: {
      first: { id: 'first', name: 'Alpha', value: 0, maximum: 4 }, second: { id: 'second', name: 'Beta', value: 1, maximum: 4 }
    } };
    const onSave = vi.fn(), onSaveBatch = vi.fn();
    render(<Provider store={store}>{kind === 'Rollable' ? <ActorRollables actor={state.actors.byId.a} />
      : <CounterControls kind={kind === 'Clock' ? 'clock' : 'counter'} counters={counters} disabled={false} onAdjust={vi.fn()} onSave={onSave} onSaveBatch={onSaveBatch} />}</Provider>);
    return { onSave, onSaveBatch };
  }
  function rename(name: string) {
    const input = screen.getByRole('textbox', { name: nameLabel });
    input.focus(); fireEvent.change(input, { target: { value: name } }); return input;
  }
  function choose(name: string) {
    fireEvent.click(screen.getByRole('combobox', { name: selectionLabel }));
    const menu = screen.getByRole('dialog', { name: selectionLabel });
    fireEvent.click(within(menu).getByRole('button', { name }));
  }

  it('opens Add in the edit dialog with a new item and its Name field focused', () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: addLabel }));
    expect(screen.getByRole('textbox', { name: nameLabel })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: nameLabel })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: selectionLabel })).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('offers direct creation for an empty list and focuses Name after creation', () => {
    setup(true); fireEvent.click(screen.getByRole('button', { name: editLabel }));
    expect(screen.queryByRole('combobox', { name: selectionLabel })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sort alphabetically' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: createLabel }));
    expect(screen.getByRole('textbox', { name: nameLabel })).toHaveFocus();
    expect(screen.getByRole('combobox', { name: selectionLabel })).toBeInTheDocument();
  });

  it('focuses Name when creating from an existing list dropdown', () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: editLabel }));
    choose(createLabel);
    expect(screen.getByRole('textbox', { name: nameLabel })).toHaveFocus();
    expect(screen.getByRole('combobox', { name: selectionLabel })).toHaveAttribute('aria-expanded', 'false');
  });

  it('confirms Escape on a dirty edit, focuses Discard, and preserves the draft on Continue editing', () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: editLabel }));
    const input = rename('Changed'); fireEvent.keyDown(input, { key: 'Escape' });
    const prompt = screen.getByRole('dialog', { name: 'Unsaved changes' });
    expect(within(prompt).getByRole('button', { name: 'Discard changes' })).toHaveFocus();
    fireEvent.click(within(prompt).getByRole('button', { name: 'Continue editing' }));
    expect(input).toHaveValue('Changed'); expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Discard changes' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(input).toHaveValue('Changed');
  });

  it('cancels a single dirty item directly but confirms multiple dirty items', () => {
    const callbacks = setup(); fireEvent.click(screen.getByRole('button', { name: editLabel }));
    rename('Changed'); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: editLabel })); rename('Changed');
    choose('Beta'); rename('Also changed');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callbacks.onSave).not.toHaveBeenCalled(); expect(callbacks.onSaveBatch).not.toHaveBeenCalled();
    expect(store.getState().encounter.past).toHaveLength(0);
  });

  it('marks dirty dropdown choices and clears the marker when the edit is reverted', () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: editLabel })); rename('Changed');
    fireEvent.click(screen.getByRole('combobox', { name: selectionLabel }));
    const menu = screen.getByRole('dialog', { name: selectionLabel });
    expect(within(menu).getByRole('button', { name: 'Changed' })).toHaveAccessibleDescription('Unsaved changes');
    expect(within(menu).getByRole('button', { name: 'Beta' })).not.toHaveAttribute('aria-description');
    fireEvent.click(within(menu).getByRole('button', { name: 'Changed' })); rename('Alpha');
    fireEvent.click(screen.getByRole('combobox', { name: selectionLabel }));
    expect(within(screen.getByRole('dialog', { name: selectionLabel })).getByRole('button', { name: 'Alpha' })).not.toHaveAttribute('aria-description');
    fireEvent.keyDown(screen.getByRole('dialog', { name: selectionLabel }), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: nameLabel }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
