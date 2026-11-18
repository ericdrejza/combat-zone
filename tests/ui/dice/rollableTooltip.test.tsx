import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RollableTooltip } from "@ui/dice/RollableTooltip";
import type { Rollable } from "@core/dice/types";

const rollable: Rollable = { id: 'strike', name: 'Strike', checkFormula: 'd20+5', checkRollMode: "shared", effectFormula: '2d6+4', effectKind: 'damage', audioGroupId: null };
it('exposes the configured formulas and effect on hover and keyboard focus', () => {
  const { rerender } = render(<RollableTooltip rollable={rollable}><button>Strike</button></RollableTooltip>);
  const button = screen.getByRole('button');
  fireEvent.mouseEnter(button);
  expect(screen.getByRole('tooltip')).toHaveTextContent('d20+5 · 2d6+4 · damage');
  fireEvent.mouseLeave(button);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.focus(button);
  expect(screen.getByRole('tooltip')).toHaveTextContent('d20+5 · 2d6+4 · damage');
  rerender(<RollableTooltip rollable={{ ...rollable, checkFormula: '', checkRollMode: "shared", effectKind: 'none' }}><button>Strike</button></RollableTooltip>);
  expect(screen.getByRole('tooltip')).toHaveTextContent(/^2d6\+4$/);
  fireEvent.blur(button);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
