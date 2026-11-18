import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import type { DiceNode } from "@core/dice/types";
import { DiceResultTree } from "@ui/dice/DiceResultTree";
const number = (value: number): DiceNode => ({ type: 'number', value, valid: true });
it('omits enclosing result parentheses while retaining nested arithmetic grouping', () => {
  const node: DiceNode = { type: 'expression', value: 18, valid: true, operators: ['*'], children: [number(2),
    { type: 'expression', value: 9, valid: true, operators: ['+'], children: [number(3), number(6)] }] };
  const { container } = render(<DiceResultTree node={node} />);
  expect(container.textContent).toBe('2*(3+6)');
});
it('omits redundant outer single-child groups but preserves function-call parentheses', () => {
  const node: DiceNode = { type: 'group', value: 3, valid: true, children: [
    { type: 'mathfunction', value: 3, valid: true, operators: ['floor'], children: [number(3.5)] }] };
  const { container } = render(<DiceResultTree node={node} />);
  expect(container.textContent).toBe('floor(3.5)');
});
