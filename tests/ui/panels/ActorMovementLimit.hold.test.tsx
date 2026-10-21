import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { createActor } from '@entities/actor/actorMutations';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { ActorMovementLimit } from '@ui/panels/status_panel/ActorMovementLimit';
import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from '@ui/controls/RepeatButton';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function Harness() {
  const [actor, setActor] = useState(() => ({
    ...createActor(createEncounterState({ id: 'hold', name: 'Hold' }), {
      id: 'a', name: 'Alpha', currentZoneId: 'zoneless'
    }).actors.byId.a,
    movementLimit: 12.5
  }));
  return <ActorMovementLimit actor={actor} unit="ft" step={5}
    onChange={(movementLimit) => setActor({ ...actor, movementLimit: movementLimit ?? 0 })} />;
}

it.each(['mouse', 'touch'])("repeats movement grid steps on %s hold and stops on release", (pointerType) => {
  render(<Harness />);
  const button = screen.getByRole('button', { name: 'Increase movement limit' });
  const input = () => screen.getByRole('spinbutton', { name: 'Movement limit' });
  fireEvent.pointerDown(button, { button: 0, pointerId: 1, pointerType });
  expect(input()).toHaveValue(15);
  act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS));
  expect(input()).toHaveValue(20);
  act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS));
  expect(input()).toHaveValue(25);
  expect(input()).not.toHaveFocus();
  fireEvent.pointerUp(button, { pointerId: 1 });
  fireEvent.click(button, { detail: 1 });
  act(() => vi.advanceTimersByTime(1000));
  expect(input()).toHaveValue(25);
});

it('repeats decrements without going below zero and stops when leaving', () => {
  render(<Harness />);
  const button = screen.getByRole('button', { name: 'Decrease movement limit' });
  fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
  expect(screen.getByRole('spinbutton', { name: 'Movement limit' })).toHaveValue(10);
  act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS));
  expect(screen.getByRole('spinbutton', { name: 'Movement limit' })).toHaveValue(5);
  fireEvent.pointerLeave(button);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('spinbutton', { name: 'Movement limit' })).toHaveValue(5);
  fireEvent.pointerDown(button, { button: 0, pointerId: 2 });
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('spinbutton', { name: 'Movement limit' })).toHaveValue(0);
  fireEvent.pointerCancel(button, { pointerId: 2 });
});
