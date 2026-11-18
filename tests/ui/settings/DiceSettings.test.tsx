import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NOTATION_GUIDE } from "@core/dice/notationGuide";
import { DiceSettings } from "@ui/settings/DiceSettings";

it('copies each notation card formula without its heading or description', async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  render(<DiceSettings />);
  for (const [title, example] of NOTATION_GUIDE) {
    const card = screen.getByRole('article', { name: title });
    await user.click(within(card).getByRole('button', { name: `Copy ${title} example` }));
    expect(write).toHaveBeenLastCalledWith(example);
    expect(within(card).getByRole('status')).not.toBeEmptyDOMElement();
  }
  expect(write).toHaveBeenCalledTimes(NOTATION_GUIDE.length);
});

it('reports clipboard failure and allows retrying the same formula', async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Clipboard unavailable')).mockResolvedValue();
  render(<DiceSettings />);
  const card = screen.getByRole('article', { name: 'Labels' });
  const copy = within(card).getByRole('button', { name: 'Copy Labels example' });
  await user.click(copy);
  expect(within(card).getByRole('alert')).toBeInTheDocument();
  expect(within(card).getByRole('status')).toBeEmptyDOMElement();
  await user.click(copy);
  expect(write).toHaveBeenLastCalledWith('2d6[Physical] + 1d6[Magic]');
  expect(within(card).queryByRole('alert')).not.toBeInTheDocument();
  expect(within(card).getByRole('status')).not.toBeEmptyDOMElement();
});
