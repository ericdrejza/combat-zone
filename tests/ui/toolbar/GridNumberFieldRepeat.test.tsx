import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GridNumberField } from '@ui/toolbar/grid/GridNumberField';
import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from '@ui/controls/RepeatButton';

function Harness({ label, initial = 2.3 }: { label: string; initial?: number }) {
  const [value, setValue] = useState(initial);
  return <GridNumberField label={label} positive={label === 'Cell size'} value={value} onChange={setValue} />;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each(['Cell size', 'Origin X', 'Origin Y'])('%s hold controls', label => {
  it.each(['mouse', 'touch', 'pen'])('repeats both directions by whole numbers with %s input', pointerType => {
    render(<Harness label={label} />);
    const field = screen.getByRole('spinbutton', { name: label });
    const increase = screen.getByRole('button', { name: `Increase ${label}` });
    fireEvent.pointerDown(increase, { button: 0, pointerId: 1, pointerType });
    expect(field).toHaveValue(3);
    act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS - 1));
    expect(field).toHaveValue(3);
    act(() => vi.advanceTimersByTime(1));
    expect(field).toHaveValue(4);
    act(() => vi.advanceTimersByTime(REPEAT_INTERVAL_MS));
    expect(field).toHaveValue(5);
    fireEvent.pointerUp(increase, { pointerId: 1 });
    fireEvent.click(increase, { detail: 1 });
    act(() => vi.advanceTimersByTime(1000));
    expect(field).toHaveValue(5);

    const decrease = screen.getByRole('button', { name: `Decrease ${label}` });
    fireEvent.pointerDown(decrease, { button: 0, pointerId: 2, pointerType });
    expect(field).toHaveValue(4);
    act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS));
    expect(field).toHaveValue(3);
    fireEvent.pointerLeave(decrease);
    act(() => vi.advanceTimersByTime(1000));
    expect(field).toHaveValue(3);
  });
});

it('stops repeating at the positive cell-size bound', () => {
  render(<Harness label="Cell size" initial={2.3} />);
  const decrease = screen.getByRole('button', { name: 'Decrease Cell size' });
  fireEvent.pointerDown(decrease, { button: 0, pointerId: 1 });
  expect(screen.getByRole('spinbutton')).toHaveValue(2);
  act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS));
  expect(screen.getByRole('spinbutton')).toHaveValue(1);
  expect(decrease).toBeDisabled();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('spinbutton')).toHaveValue(1);
});

it('allows held origin decrements below zero', () => {
  render(<Harness label="Origin X" initial={0.5} />);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Decrease Origin X' }), { button: 0, pointerId: 1 });
  expect(screen.getByRole('spinbutton')).toHaveValue(0);
  act(() => vi.advanceTimersByTime(REPEAT_DELAY_MS));
  expect(screen.getByRole('spinbutton')).toHaveValue(-1);
});
