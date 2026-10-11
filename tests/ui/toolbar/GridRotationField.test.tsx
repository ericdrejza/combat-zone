import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GridNumberField } from '@ui/toolbar/grid/GridNumberField';
import { normalizeGridRotation } from '@core/movement/gridRotation';
import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from '@ui/controls/RepeatButton';

function Harness() {
  const [value, setValue] = useState(89.95);
  return <GridNumberField rotation label="Rotation" value={value} onChange={next => setValue(normalizeGridRotation(next, 'square'))} />;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); });

it('steps by 0.1, accelerates held presses to 1, and stops without a release increment', () => {
  render(<Harness />);
  const increase = screen.getByRole('button', { name: 'Increase Rotation' });
  const field = screen.getByRole('spinbutton', { name: 'Rotation' });
  expect(increase).toHaveAttribute('title', 'Increase Rotation (hold to repeat)');
  fireEvent.pointerDown(increase, { button: 0, pointerId: 1 });
  expect(field).toHaveValue(0.05);
  act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS - 1));
  expect(field).toHaveValue(0.05);
  act(() => vi.advanceTimersByTime(1)); expect(field).toHaveValue(0.15);
  for (let i = 0; i < 8; i++) act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS));
  expect(field).toHaveValue(0.95);
  act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS)); expect(field).toHaveValue(1);
  act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS)); expect(field).toHaveValue(2);
  fireEvent.pointerUp(increase, { pointerId: 1 });
  fireEvent.click(increase, { detail: 1 }); expect(field).toHaveValue(2);
  act(() => vi.advanceTimersByTime(1000)); expect(field).toHaveValue(2);
  fireEvent.click(screen.getByRole('button', { name: 'Decrease Rotation' })); expect(field).toHaveValue(1.9);
});

it('accelerates keyboard repeats, resets on key release, and rounds typed degrees to hundredths', () => {
  render(<Harness />);
  const field = screen.getByRole('spinbutton', { name: 'Rotation' });
  fireEvent.change(field, { target: { value: '17.236' } }); expect(field).toHaveValue(17.24);
  fireEvent.keyDown(field, { key: 'ArrowUp' }); expect(field).toHaveValue(17.34);
  act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS));
  fireEvent.keyDown(field, { key: 'ArrowUp', repeat: true }); expect(field).toHaveValue(17.44);
  fireEvent.keyUp(field, { key: 'ArrowUp' });
  fireEvent.keyDown(field, { key: 'ArrowDown' }); expect(field).toHaveValue(17.34);
});

it.each(['pointerCancel', 'blur', 'pointerLeave'])('stops a held rotation change on %s', event => {
  render(<Harness />);
  const increase = screen.getByRole('button', { name: 'Increase Rotation' });
  fireEvent.pointerDown(increase, { button: 0, pointerId: 1 });
  if (event === 'blur') fireEvent.blur(window);
  else if (event === 'pointerCancel') fireEvent.pointerCancel(increase, { pointerId: 1 });
  else fireEvent.pointerLeave(increase, { pointerId: 1 });
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('spinbutton', { name: 'Rotation' })).toHaveValue(0.05);
});

it('decrements fractional held values to a whole degree before taking whole steps', () => {
  render(<Harness />);
  const field = screen.getByRole('spinbutton', { name: 'Rotation' });
  fireEvent.change(field, { target: { value: '17.36' } });
  const decrease = screen.getByRole('button', { name: 'Decrease Rotation' });
  fireEvent.pointerDown(decrease, { button: 0, pointerId: 1 }); expect(field).toHaveValue(17.26);
  act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS)); expect(field).toHaveValue(17.16);
  act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS)); expect(field).toHaveValue(17.06);
  act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS)); expect(field).toHaveValue(17);
  act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS)); expect(field).toHaveValue(16);
  fireEvent.pointerUp(decrease, { pointerId: 1 });
});
