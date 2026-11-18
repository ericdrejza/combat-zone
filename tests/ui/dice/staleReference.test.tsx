import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { StaleReference } from "@ui/dice/StaleReference";

it('shows its warning only after activation, with an accessible description', () => {
  render(<StaleReference text="@Deleted" color="#123456" />);
  const reference = screen.getByRole('button', { name: '@Deleted' });
  fireEvent.mouseEnter(reference);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  reference.focus();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.click(reference);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Stale reference');
  expect(reference).toHaveAccessibleDescription('Stale reference');
  fireEvent.mouseLeave(reference);
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.keyDown(reference, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.mouseEnter(reference);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('supports keyboard activation and dismisses on outside interaction or focus loss', async () => {
  const user = userEvent.setup();
  render(<><StaleReference text="@Deleted" color={null} /><button>Other</button></>);
  const reference = screen.getByRole('button', { name: '@Deleted' });
  reference.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  await user.tab();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  reference.focus(); await user.keyboard(' ');
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
