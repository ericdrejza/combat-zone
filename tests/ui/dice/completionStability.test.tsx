import { Profiler } from "react";
import { Provider } from "react-redux";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { LogPanel } from "@ui/panels/LogPanel";

beforeEach(() => { setPersistenceWritable(true); store.dispatch(loadEncounterState(diceEncounter())); });
function setup() {
  render(<Provider store={store}><LogPanel /></Provider>);
  return screen.getByRole('textbox', { name: 'Chat message' }) as HTMLTextAreaElement;
}
function selected(name: string | RegExp) {
  expect(screen.getByRole('option', { name })).toHaveAttribute('aria-selected', 'true');
}

it('retains compact-name completion through spaces and accepts the actual quoted name', async () => {
  const state = diceEncounter();
  state.actors.byId.a.name = 'Hero 12';
  store.dispatch(loadEncounterState(state));
  const user = userEvent.setup(); const input = setup();
  await user.type(input, '@hero1');
  selected(/Hero 12/);
  expect(screen.getByText('2', { selector: '[aria-hidden="true"] span' })).toBeInTheDocument();
  await user.keyboard('{Backspace}');
  selected(/Hero 12/);
  expect(screen.getByText('12', { selector: '[aria-hidden="true"] span' })).toBeInTheDocument();
  await user.keyboard('1{Tab}');
  expect(input).toHaveValue('@"Hero 12"');
});

it('keeps the chosen actor through typing and deletion until its prefix stops matching', async () => {
  const user = userEvent.setup(); const input = setup();
  await user.type(input, '@');
  await user.keyboard('{ArrowDown}'); selected(/Guard/);
  await user.keyboard('G'); selected(/Guard/);
  expect(screen.getByText('uard')).toBeInTheDocument();
  await user.keyboard('u{Backspace}'); selected(/Guard/);
  expect(screen.getByText('uard')).toBeInTheDocument();
  await user.keyboard('o'); selected(/Goblin Chief/);
  expect(screen.getByText('blin Chief')).toBeInTheDocument();
  await user.keyboard('{Tab}');
  expect(input).toHaveValue('@"Goblin Chief"');
});

it('retains command completion when deleting back to a shared prefix', async () => {
  const user = userEvent.setup(); const input = setup();
  await user.type(input, '/ro'); selected('/roll');
  await user.keyboard('{Backspace}'); selected('/roll');
  expect(screen.getByText('oll')).toBeInTheDocument();
  await user.keyboard('r'); selected('/rr');
  await user.keyboard('{Backspace}'); selected('/rr');
  expect(screen.getByText('r', { selector: '[aria-hidden="true"] span' })).toBeInTheDocument();
  await user.keyboard('{Tab}'); expect(input).toHaveValue('/rr ');
});

it('keeps a chosen rollable when editing a shared prefix', async () => {
  const state = diceEncounter();
  const rollables = state.actors.byId.a.rollables!;
  rollables.byId.slam = { ...rollables.byId.slash, id: 'slam', name: 'Slam attack' };
  rollables.allIds.push('slam'); store.dispatch(loadEncounterState(state));
  const user = userEvent.setup(); const input = setup();
  fireEvent.change(input, { target: { value: '@"Goblin Chief"/Sl' } });
  input.focus(); input.setSelectionRange(input.value.length, input.value.length); fireEvent.select(input);
  await user.keyboard('{ArrowDown}'); selected('Slam attack');
  await user.keyboard('a{Backspace}'); selected('Slam attack');
  expect(screen.getByText('am attack')).toBeInTheDocument();
  await user.keyboard('as'); selected('Slash');
  await user.keyboard('{Tab}'); expect(input).toHaveValue('@"Goblin Chief"/Slash');
});

it('commits the typed prefix and remaining completion together on every edit', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const snapshots: string[] = [];
  render(<Profiler id="completion" onRender={() => {
    const input = container.querySelector('textarea');
    const preview = input?.parentElement?.querySelector(':scope > [aria-hidden="true"]');
    if (input?.value.startsWith('@Gu') && preview) snapshots.push(preview.textContent ?? '');
  }}><Provider store={store}><LogPanel /></Provider></Profiler>, { container });
  const input = screen.getByRole('textbox', { name: 'Chat message' });
  const user = userEvent.setup();
  fireEvent.change(input, { target: { value: '@Gu' } });
  input.focus();
  await user.keyboard('ar{Backspace}{Backspace}');
  expect(snapshots.length).toBeGreaterThan(4);
  expect(new Set(snapshots)).toEqual(new Set(['@Guard']));
  expect(input).toHaveValue('@Gu');
});
