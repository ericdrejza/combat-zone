import { Provider } from "react-redux";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { LOCAL_CHAT_SENDER_ID, type ChatMessage } from "@core/chat/types";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { LogPanel } from "@ui/panels/LogPanel";

function message(id: string, text: string, sender = LOCAL_CHAT_SENDER_ID): ChatMessage {
  return { id, message: text, timestamp: 1, sender: { id: sender, name: sender, color: null } };
}
function setup(entries = [message('first', 'First message'), message('other', 'Another user', 'other-user'), message('last', 'Latest message')], configure?: (state: ReturnType<typeof diceEncounter>) => void) {
  const state = diceEncounter();
  configure?.(state);
  state.chatMessages = { allIds: entries.map(entry => entry.id), byId: Object.fromEntries(entries.map(entry => [entry.id, entry])) };
  store.dispatch(loadEncounterState(state));
  render(<Provider store={store}><LogPanel /></Provider>);
  return screen.getByRole('textbox', { name: 'Chat message' }) as HTMLTextAreaElement;
}
function draft(input: HTMLTextAreaElement, text: string, caret = text.length) {
  fireEvent.change(input, { target: { value: text } });
  input.focus(); input.setSelectionRange(caret, caret); fireEvent.select(input);
}
function arrow(input: HTMLTextAreaElement, key: 'ArrowUp' | 'ArrowDown') {
  const event = createEvent.keyDown(input, { key }); fireEvent(input, event); return event;
}
beforeEach(() => setPersistenceWritable(true));

it('browses only sent messages, stops at the oldest, and restores the draft and its caret', () => {
  const input = setup(); draft(input, 'Current draft\nSecond line', 4);
  const before = structuredClone(store.getState().encounter.present.chatMessages);
  expect(arrow(input, 'ArrowUp').defaultPrevented).toBe(true); expect(input).toHaveValue('Latest message');
  arrow(input, 'ArrowUp'); expect(input).toHaveValue('First message');
  arrow(input, 'ArrowUp'); expect(input).toHaveValue('First message');
  arrow(input, 'ArrowDown'); expect(input).toHaveValue('Latest message');
  arrow(input, 'ArrowDown'); expect(input).toHaveValue('Current draft\nSecond line'); expect(input.selectionStart).toBe(4);
  expect(arrow(input, 'ArrowDown').defaultPrevented).toBe(false);
  expect(store.getState().encounter.present.chatMessages).toEqual(before);
  expect(store.getState().encounter.past).toHaveLength(0);
});
it('starts history only on the first draft line without modifiers or a selected range', () => {
  const input = setup(); draft(input, 'First\nSecond');
  expect(arrow(input, 'ArrowUp').defaultPrevented).toBe(false); expect(input).toHaveValue('First\nSecond');
  input.setSelectionRange(1, 3); expect(arrow(input, 'ArrowUp').defaultPrevented).toBe(false);
  input.setSelectionRange(2, 2);
  const event = createEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true }); fireEvent(input, event);
  expect(event.defaultPrevented).toBe(false);
  arrow(input, 'ArrowUp'); expect(input).toHaveValue('Latest message');
});
it('keeps edits to recalled messages while browsing without changing sent content', async () => {
  const user = userEvent.setup(); const input = setup(); draft(input, 'Unsent');
  arrow(input, 'ArrowUp'); await user.keyboard(' edited');
  arrow(input, 'ArrowUp'); arrow(input, 'ArrowDown'); expect(input).toHaveValue('Latest message edited');
  arrow(input, 'ArrowDown'); expect(input).toHaveValue('Unsent');
  expect(store.getState().encounter.present.chatMessages.byId.last.message).toBe('Latest message');
});
it('skips explicit multiline messages while retaining long single-line messages', () => {
  const long = 'Long single-line message '.repeat(30);
  const input = setup([message('first', 'First'), message('multi', 'First\nMultiline'), message('long', long), message('last', 'Last\nMultiline')]);
  input.focus(); arrow(input, 'ArrowUp'); expect(input).toHaveValue(long);
  arrow(input, 'ArrowUp'); expect(input).toHaveValue('First');
  arrow(input, 'ArrowDown'); expect(input).toHaveValue(long);
  arrow(input, 'ArrowDown'); expect(input).toHaveValue('');
});
it('gives suggestions priority over message history', () => {
  const input = setup(); draft(input, '/'); arrow(input, 'ArrowUp');
  expect(input).toHaveValue('/');
  expect(screen.getByRole('option', { name: '/rr' })).toHaveAttribute('aria-selected', 'true');
});
it('suppresses suggestions throughout recall until the user types or deletes again', async () => {
  const user = userEvent.setup();
  const input = setup([message('actor', '@Gu'), message('command', '/ro')]);
  input.focus(); arrow(input, 'ArrowUp'); expect(input).toHaveValue('/ro');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  arrow(input, 'ArrowUp'); expect(input).toHaveValue('@Gu');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  arrow(input, 'ArrowDown'); expect(input).toHaveValue('/ro');
  await user.keyboard('{Backspace}');
  expect(screen.getByRole('option', { name: '/roll' })).toBeInTheDocument();
});
it('starts fresh after sending and includes the newly sent message', () => {
  const input = setup(); draft(input, 'Keep'); arrow(input, 'ArrowUp');
  draft(input, 'Edited resend'); fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(input).toHaveValue(''); arrow(input, 'ArrowUp'); expect(input).toHaveValue('Edited resend');
  arrow(input, 'ArrowDown'); expect(input).toHaveValue('');
});
it('keeps duplicate-name reference choices when recalling and restoring a draft', () => {
  const input = setup(undefined, state => { state.actors.byId.c.name = 'Guard'; });
  draft(input, '@Gu'); fireEvent.click(screen.getAllByRole('option', { name: /^Guard/ })[1]);
  arrow(input, 'ArrowUp'); expect(input).toHaveValue('Latest message');
  arrow(input, 'ArrowDown'); expect(input).toHaveValue('@Guard');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  const messages = store.getState().encounter.present.chatMessages;
  expect(messages.byId[messages.allIds.at(-1)!].references?.[0].entityId).toBe('c');
});
it('restores the saved identity of a recalled duplicate-name reference', () => {
  const saved = message('reference', '@Guard');
  saved.references = [{ start: 0, end: 6, entityId: 'c', kind: 'actor', color: null }];
  const input = setup([saved], state => { state.actors.byId.c.name = 'Guard'; });
  input.focus(); arrow(input, 'ArrowUp');
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  const messages = store.getState().encounter.present.chatMessages;
  expect(messages.byId[messages.allIds.at(-1)!].references?.[0].entityId).toBe('c');
});
it('does not intercept arrows with no own sent messages', () => {
  const input = setup([message('other', 'Another user', 'other-user')]); draft(input, 'Draft');
  expect(arrow(input, 'ArrowUp').defaultPrevented).toBe(false); expect(input).toHaveValue('Draft');
});
it('skips consecutive and nonconsecutive duplicates in both directions', () => {
  const input = setup([
    message('first', 'First'), message('echo1', 'Echo'), message('middle', 'Middle'),
    message('echo2', 'Echo'), message('echo3', 'Echo'), message('latest', 'Latest'),
  ]);
  draft(input, 'Unsent');
  for (const expected of ['Latest', 'Echo', 'Middle', 'First', 'First']) {
    arrow(input, 'ArrowUp'); expect(input).toHaveValue(expected);
  }
  for (const expected of ['Middle', 'Echo', 'Latest', 'Unsent']) {
    arrow(input, 'ArrowDown'); expect(input).toHaveValue(expected);
  }
});
