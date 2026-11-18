import { Provider } from "react-redux";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { createZone } from "@entities/zone/zoneMutations";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { LogPanel } from "@ui/panels/LogPanel";

beforeEach(() => {
  setPersistenceWritable(true);
  const state = createZone(diceEncounter(), { id: 'z', name: 'Great Hall', polygon: [] });
  state.actors.byId.b.name = 'Goblin Guard'; state.actors.byId.b.currentZoneId = 'z';
  state.actors.byId.a.currentZoneId = 'z';
  const rollables = state.actors.byId.a.rollables!;
  rollables.byId.slash.name = 'Heavy Slash';
  rollables.byId.strike = { ...rollables.byId.slash, id: 'strike', name: 'Heavy Strike' };
  rollables.allIds.push('strike');
  store.dispatch(loadEncounterState(state));
});
function setup() {
  render(<Provider store={store}><LogPanel /></Provider>);
  return screen.getByRole('textbox', { name: 'Chat message' }) as HTMLTextAreaElement;
}

for (const quote of ['"', "'"]) {
  it.each([
    ['@', 'Goblin', 'G', 'Goblin Guard'],
    ['@"Great Hall".', 'Goblin', 'G', 'Goblin Guard'],
    ['@Goblin/', 'Heavy', 'St', 'Heavy Strike'],
    ['@', 'Great', 'H', 'Great Hall'],
  ])(`keeps Space literal with ${quote} when a multiword alternative exists in %s`, async (prefix, single, refinement, name) => {
    const state = createZone(structuredClone(store.getState().encounter.present), { id: 'great', name: 'Great', polygon: [] });
    state.actors.byId.a.name = 'Goblin';
    state.actors.byId.a.rollables!.byId.slash.name = 'Heavy';
    store.dispatch(loadEncounterState(state));
    const input = setup(); const user = userEvent.setup();
    const start = prefix + quote;
    fireEvent.change(input, { target: { value: start + single } });
    input.focus(); input.setSelectionRange(input.value.length, input.value.length); fireEvent.select(input);
    const singleOption = screen.getByRole('option', { name: new RegExp(`^${single}(?: \\(Zone\\)| \\(Actor|$)`) });
    fireEvent.mouseEnter(singleOption);
    expect(singleOption).toHaveAttribute('aria-selected', 'true');
    await user.keyboard(' ');
    expect(input).toHaveValue(start + single + ' ');
    await user.keyboard(refinement + '{Tab}');
    expect(input).toHaveValue(start + name + quote);
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
  });

  it.each([
    ['@', 'Goblin Guard', 'Goblin G'],
    ['', 'Great Hall', 'Great H'],
    ['@"Great Hall".', 'Goblin Guard', 'Goblin G'],
    ['@"Goblin Chief"/', 'Heavy Strike', 'Heavy St'],
  ])(`lets spaces refine a ${quote}-quoted multiword suggestion in %s`, async (prefix, name, typed) => {
    const input = setup(); const user = userEvent.setup();
    const start = (prefix || '@') + quote;
    fireEvent.change(input, { target: { value: start } });
    input.focus(); input.setSelectionRange(start.length, start.length); fireEvent.select(input);
    await user.keyboard(typed);
    expect(input).toHaveValue(start + typed);
    expect(screen.getByRole('option', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Tab}');
    expect(input).toHaveValue(start + name + quote);
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
  });

  it(`keeps Space literal after keyboard navigation in a ${quote}-quoted multiword name`, async () => {
    const input = setup(); const user = userEvent.setup();
    fireEvent.change(input, { target: { value: `@${quote}Goblin` } });
    input.focus(); input.setSelectionRange(input.value.length, input.value.length); fireEvent.select(input);
    await user.keyboard('{ArrowDown} ');
    expect(input).toHaveValue(`@${quote}Goblin `);
    expect(screen.getByRole('option', { name: /^Goblin Guard/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('Gu{Enter}');
    expect(input).toHaveValue(`@${quote}Goblin Guard${quote}`);
    expect(store.getState().encounter.present.chatMessages.allIds).toHaveLength(0);
  });

  it(`still completes a ${quote}-quoted single-word suggestion with Space`, async () => {
    const input = setup(); const user = userEvent.setup();
    fireEvent.change(input, { target: { value: `@${quote}Sco` } });
    input.focus(); input.setSelectionRange(input.value.length, input.value.length); fireEvent.select(input);
    await user.keyboard(' ');
    expect(input).toHaveValue(`@${quote}Scout${quote}`);
  });
}

it('still completes an unquoted multiword suggestion with Space', async () => {
  const input = setup(); const user = userEvent.setup();
  await user.type(input, '@Gob'); await user.keyboard(' ');
  expect(input).toHaveValue('@"Goblin Chief"');
});
