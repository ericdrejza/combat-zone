import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { LogPanel } from "@ui/panels/LogPanel";
import { TARGET_PREVIEW_EVENT } from "@ui/dice/MentionSuggestions";
import { createZone } from "@entities/zone/zoneMutations";
import { evaluateDice } from "@core/dice/evaluate";
vi.mock("@core/dice/workerClient", () => ({ rollFormulas: vi.fn(async (formulas: string[]) => formulas.map(f => evaluateDice(f, () => .5))) }));
beforeEach(() => { setPersistenceWritable(true); store.dispatch(loadEncounterState(diceEncounter())); });
function setup() { render(<Provider store={store}><LogPanel /></Provider>); return screen.getByRole('textbox', { name: 'Chat message' }); }
function type(input: HTMLElement, value: string) { fireEvent.change(input, { target: { value } }); }
function messages() { return store.getState().encounter.present.chatMessages; }

it.each(['Tab', 'Enter', ' '])('accepts the first entity immediately with %s without sending', key => {
  const input = setup(); type(input, '@Gu');
  expect(screen.getByRole('option', { name: /Guard/ })).toHaveAttribute('aria-selected', 'true');
  expect(input).toHaveAttribute('aria-autocomplete', 'both');
  expect(screen.getByText('ard')).toBeInTheDocument();
  expect(input).toHaveValue('@Gu');
  fireEvent.keyDown(input, { key });
  expect(input).toHaveValue('@Guard');
  expect(messages().allIds).toHaveLength(0);
  expect(screen.queryByText('ard')).not.toBeInTheDocument();
});

it('updates the inline completion while typing and clears it on dismissal or substring matches', () => {
  const input = setup(); type(input, '@Go');
  expect(screen.getByText('blin Chief')).toBeInTheDocument();
  type(input, '@Gob');
  expect(screen.getByText('lin Chief')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByText('lin Chief')).not.toBeInTheDocument();
  type(input, '@uard');
  expect(screen.getByRole('option', { name: /Guard/ })).toHaveAttribute('aria-selected', 'true');
  expect(input).toHaveAttribute('aria-autocomplete', 'list');
  fireEvent.keyDown(input, { key: 'Tab' });
  expect(input).toHaveValue('@Guard');
});

it('completes quoted names and scoped faction prefixes immediately', () => {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Courtyard', polygon: [] });
  state.actors.byId.b.currentZoneId = 'z'; state.actors.byId.b.layoutGroup = 'enemy';
  store.dispatch(loadEncounterState(state));
  const input = setup(); type(input, '@"Gob');
  expect(screen.getByText('lin Chief')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Tab' });
  expect(input).toHaveValue('@"Goblin Chief"');
  type(input, '@Courtyard.en');
  expect(screen.getByText('emies')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input).toHaveValue('@Courtyard.enemies');
  expect(messages().allIds).toHaveLength(0);
});

it.each(['Tab', 'Enter', ' '])('completes slash commands with %s after arrow navigation without sending', key => {
  const input = setup(); type(input, '/');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(screen.getByRole('option', { name: '/roll' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(input, { key });
  expect(input).toHaveValue('/roll ');
  expect(messages().allIds).toHaveLength(0);
});
it.each(['Tab', 'Enter', ' '])('immediately completes commands and actor rollables with %s without sending', key => {
  const input = setup();
  for (const [draft, name, suffix, completed] of [
    ['/ro', '/roll', 'll', '/roll '],
    ['/rr', '/rr', '', '/rr '],
    ['@"Goblin Chief"/', 'Slash', 'Slash', '@"Goblin Chief"/Slash'],
    ['@"Goblin Chief"/Sl', 'Slash', 'ash', '@"Goblin Chief"/Slash'],
    ['@"Goblin Chief"/"Sl', 'Slash', 'ash', '@"Goblin Chief"/"Slash"'],
  ]) {
    type(input, draft);
    expect(screen.getByRole('option', { name })).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-autocomplete', suffix ? 'both' : 'list');
    if (suffix) expect(screen.getByText(suffix, { selector: '[aria-hidden="true"] span' })).toBeInTheDocument();
    expect(input).toHaveValue(draft);
    fireEvent.keyDown(input, { key });
    expect(input).toHaveValue(completed);
    expect(messages().allIds).toHaveLength(0);
    expect(input).not.toHaveAttribute('aria-activedescendant');
  }
});

it('selects substring rollable matches without an inline suffix and dismisses command completion', () => {
  const input = setup(); type(input, '@"Goblin Chief"/las');
  expect(screen.getByRole('option', { name: 'Slash' })).toHaveAttribute('aria-selected', 'true');
  expect(input).toHaveAttribute('aria-autocomplete', 'list');
  fireEvent.keyDown(input, { key: 'Tab' });
  expect(input).toHaveValue('@"Goblin Chief"/Slash');
  type(input, '/ro');
  expect(input).toHaveAttribute('aria-autocomplete', 'both');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveValue('/ro');
  expect(input).not.toHaveAttribute('aria-autocomplete');
});

it('updates rollable completion during keyboard navigation and resumes typing at the saved caret', async () => {
  const state = diceEncounter();
  const rollables = state.actors.byId.a.rollables!;
  rollables.byId.slam = { ...rollables.byId.slash, id: 'slam', name: 'Slam attack' };
  rollables.allIds.push('slam');
  store.dispatch(loadEncounterState(state));
  const user = userEvent.setup(); const input = setup() as HTMLTextAreaElement;
  type(input, '@"Goblin Chief"/Sl'); input.focus();
  input.setSelectionRange(input.value.length, input.value.length); fireEvent.select(input);
  const caret = input.selectionStart;
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('option', { name: 'Slam attack' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('am attack')).toBeInTheDocument();
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('option', { name: 'Slash' })).toHaveAttribute('aria-selected', 'true');
  expect(input.selectionStart).toBe(caret);
  await user.keyboard('a');
  expect(input).toHaveValue('@"Goblin Chief"/Sla');
  expect(input.selectionStart).toBe(caret + 1);
  expect(screen.getByText('sh')).toBeInTheDocument();
  await user.keyboard('{ArrowDown}{Tab}');
  expect(input).toHaveValue('@"Goblin Chief"/"Slam attack"');
  expect(messages().allIds).toHaveLength(0);
});
it('cycles upward and downward and emits the same actor preview for keyboard and pointer focus', () => {
  const input = setup();
  const listener = vi.fn(); window.addEventListener(TARGET_PREVIEW_EVENT, listener);
  try {
    type(input, '@Gu');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(listener.mock.calls.at(-1)![0].detail).toEqual(['b']);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(listener.mock.calls.at(-1)![0].detail).toEqual([]);
    type(input, '@Gua');
    fireEvent.mouseEnter(screen.getByRole('option', { name: /Guard/ }));
    expect(listener.mock.calls.at(-1)![0].detail).toEqual(['b']);
  } finally { window.removeEventListener(TARGET_PREVIEW_EVENT, listener); }
});
it('sends general references and unresolved prose without a dice syntax error', () => {
  const input = setup(); type(input, '@Guard protect @Missing please');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(messages().allIds).toHaveLength(1);
  const message = messages().byId[messages().allIds[0]];
  expect(message.references).toEqual([expect.objectContaining({ entityId: 'b', kind: 'actor' })]);
  expect(message.rolls).toBeUndefined(); expect(message.invocation).toBeUndefined();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('requires an explicit choice for colliding zone and actor names without treating it as invalid notation', () => {
  let state = createZone(diceEncounter(), { id: 'z', name: 'Guard', polygon: [] });
  store.dispatch(loadEncounterState(state));
  const input = setup(); type(input, '@Guard');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  const group = screen.getByRole('group', { name: 'Resolve ambiguous mention' });
  expect(messages().allIds).toHaveLength(0);
  fireEvent.click(within(group).getByRole('button', { name: /Guard \(2\).*Zone/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(messages().byId[messages().allIds[0]].references![0]).toMatchObject({ kind: 'zone', entityId: 'z' });
});
it('offers only populated zone factions, previews their actors, and snapshots expanded targets', async () => {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Courtyard', polygon: [] });
  state.actors.byId.b.currentZoneId = 'z'; state.actors.byId.b.layoutGroup = 'enemy';
  state.actors.byId.c.currentZoneId = 'z'; state.actors.byId.c.layoutGroup = 'enemy';
  store.dispatch(loadEncounterState(state));
  const input = setup(); type(input, '@"Goblin Chief"/Slash -> @Courtyard.');
  expect(screen.queryByRole('option', { name: /allies/ })).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Tab' });
  expect(input).toHaveValue('@"Goblin Chief"/Slash -> @Courtyard.enemies');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => expect(messages().allIds).toHaveLength(1));
  const saved = messages().byId[messages().allIds[0]];
  expect(saved.invocation!.targets.map(t => t.id)).toEqual(['b', 'c']);
  const references = structuredClone(saved.references);
  const changed = structuredClone(store.getState().encounter.present);
  changed.actors.byId.b.name = 'Renamed'; changed.actors.byId.b.layoutGroup = 'ally';
  delete changed.zones.byId.z; changed.zones.allIds = [];
  act(() => store.dispatch(loadEncounterState(changed)));
  expect(messages().byId[saved.id].references).toEqual(references);
  expect(messages().byId[saved.id].message).toContain('@Courtyard.enemies');
});

it('navigates horizontally without moving the saved text selection and resumes typing there', async () => {
  const user = userEvent.setup();
  const input = setup() as HTMLTextAreaElement;
  type(input, 'Hello @Guard, keep watch');
  input.focus(); input.setSelectionRange(7, 7); fireEvent.select(input);
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('option', { name: /Guard/ })).toHaveAttribute('aria-selected', 'true');
  expect(input.selectionStart).toBe(7); expect(input.selectionEnd).toBe(7);
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('option', { name: /Goblin Chief/ })).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('X');
  expect(input).toHaveValue('Hello @XGuard, keep watch');
  expect(input.selectionStart).toBe(8);
  expect(input).not.toHaveAttribute('aria-activedescendant');
});
it('returns typing from a tab-focused suggestion to the saved insertion point', async () => {
  const user = userEvent.setup(); const input = setup() as HTMLTextAreaElement;
  type(input, '@Gu'); input.focus(); input.setSelectionRange(3, 3); fireEvent.select(input);
  act(() => screen.getByRole('option', { name: /Guard/ }).focus());
  expect(input).toHaveFocus();
  await user.keyboard('a');
  expect(input).toHaveValue('@Gua'); expect(input.selectionStart).toBe(4);
});
it('lets a pointer click return from suggestion navigation to text editing', async () => {
  const user = userEvent.setup(); const input = setup() as HTMLTextAreaElement;
  type(input, '@'); input.focus();
  await user.keyboard('{ArrowDown}');
  fireEvent.pointerDown(input);
  input.setSelectionRange(0, 0); fireEvent.select(input);
  await user.keyboard('Hi ');
  expect(input).toHaveValue('Hi @');
});

it('reveals keyboard suggestions within the menu without scrolling its ancestors', () => {
  const input = setup(); type(input, '@'); input.focus();
  const menu = screen.getByRole('listbox', { name: 'Chat suggestions' });
  const ancestor = menu.parentElement!; ancestor.scrollTop = 11;
  vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140 } as DOMRect);
  screen.getAllByRole('option').forEach((option, i) => {
    vi.spyOn(option, 'getBoundingClientRect').mockImplementation(() => ({ top: 100 + i * 34 - menu.scrollTop, bottom: 130 + i * 34 - menu.scrollTop } as DOMRect));
  });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(menu.scrollTop).toBe(24); expect(ancestor.scrollTop).toBe(11);
});
