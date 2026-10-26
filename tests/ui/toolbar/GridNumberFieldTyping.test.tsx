import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { GridNumberField } from '@ui/toolbar/grid/GridNumberField';

function Harness({ label, onChange, initial = 64 }: { label: string; onChange: (next: number) => void; initial?: number }) {
  const [value, setValue] = useState(initial);
  return <GridNumberField label={label} rotation={label === 'Rotation'} positive={label === 'Cell size'} value={value}
    onChange={next => { setValue(next); onChange(next); }} />;
}

it.each(['Cell size', 'Rotation', 'Origin X', 'Origin Y'])('publishes typed %s edits only when focus leaves', async label => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<Harness label={label} onChange={onChange} />);
  const field = screen.getByRole('spinbutton', { name: label });
  await user.clear(field);
  await user.type(field, '32.25');
  expect(field).toHaveValue(32.25);
  expect(onChange).not.toHaveBeenCalled();
  await user.tab();
  expect(onChange).toHaveBeenCalledExactlyOnceWith(32.25);
});

it.each(['Rotation', 'Origin X', 'Origin Y'])('defaults blank %s to zero on blur', async label => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<Harness label={label} onChange={onChange} />);
  const field = screen.getByRole('spinbutton', { name: label });
  await user.clear(field);
  expect(onChange).not.toHaveBeenCalled();
  await user.tab();
  expect(field).toHaveValue(0);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(0);
});

it.each([64, 0.25])('restores the previous positive cell size %s when left blank', async initial => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<Harness label="Cell size" onChange={onChange} initial={initial} />);
  const field = screen.getByRole('spinbutton');
  await user.clear(field);
  await user.tab();
  expect(field).toHaveValue(initial);
  expect(onChange).not.toHaveBeenCalled();
});

it('restores the last valid cell size after clearing an invalid edit', async () => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<Harness label="Cell size" onChange={onChange} />);
  const field = screen.getByRole('spinbutton');
  await user.clear(field);
  await user.type(field, '-1');
  await user.tab();
  expect(onChange).toHaveBeenLastCalledWith(-1);
  await user.clear(field);
  await user.tab();
  expect(field).toHaveValue(64);
  expect(onChange).toHaveBeenLastCalledWith(64);
});

it('blurs on Enter so a focused typed edit is available before form submission', async () => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<Harness label="Cell size" onChange={onChange} />);
  const field = screen.getByRole('spinbutton');
  await user.clear(field);
  await user.type(field, '32{Enter}');
  expect(field).not.toHaveFocus();
  expect(onChange).toHaveBeenCalledExactlyOnceWith(32);
});

it('steps typed values immediately through buttons and arrow keys without a duplicate blur update', async () => {
  const user = userEvent.setup(), onChange = vi.fn();
  render(<Harness label="Origin X" onChange={onChange} />);
  const field = screen.getByRole('spinbutton');
  await user.clear(field);
  await user.type(field, '-2.4');
  await user.click(screen.getByRole('button', { name: 'Decrease Origin X' }));
  expect(field).toHaveValue(-3);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(-3);
  onChange.mockClear();
  await user.clear(field);
  await user.type(field, '2.4');
  fireEvent.keyDown(field, { key: 'ArrowUp' });
  expect(field).toHaveValue(3);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(3);
});
