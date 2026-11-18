import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { evaluateDice } from "@core/dice/evaluate";
import { DiceTotal } from "@ui/dice/DiceTotal";

it('shows label sums on hover and removes the tooltip on leave', () => {
  render(<DiceTotal result={evaluateDice('2[Fire]+4[Fire]+3[Cold]', () => .5)} />);
  const total = screen.getByText('Total: 9');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.mouseEnter(total);
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent('Fire:6'); expect(tooltip).toHaveTextContent('Cold:3');
  expect(total).toHaveAttribute('aria-describedby', tooltip.id);
  fireEvent.mouseLeave(total);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
it('exposes Other via keyboard focus and dismisses with Escape or blur', () => {
  render(<DiceTotal result={evaluateDice('d6[Fire]+3', () => .5)} />);
  const total = screen.getByText('Total: 7');
  fireEvent.focus(total);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Other:3');
  fireEvent.keyDown(total, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.focus(total); fireEvent.blur(total);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
it('shows final contributions instead of listing a multiplier as Other', () => {
  render(<DiceTotal result={evaluateDice('(2[Fire]+3[Cold])*2', () => .5)} />);
  fireEvent.mouseEnter(screen.getByText('Total: 10'));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Fire:4Cold:6');
  expect(screen.getByRole('tooltip')).not.toHaveTextContent('Other');
});
it.each(['d6+3', 'd6[Fire]', 'd6[Fire]+d4[Fire]'])('does not show a tooltip for %s', formula => {
  render(<DiceTotal result={evaluateDice(formula, () => .5)} />);
  const total = screen.getByText(/^Total:/);
  fireEvent.mouseEnter(total);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(total).not.toHaveAttribute('tabindex');
});
