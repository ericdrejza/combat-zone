import { expect, it } from "vitest";
import { evaluateDice } from "@core/dice/evaluate";
import { labelBreakdown } from "@core/dice/labelBreakdown";
const breakdown = (formula: string) => labelBreakdown(evaluateDice(formula, () => .5).node);

it('combines repeated labels into subtotals', () => {
  expect(breakdown('2[Fire]+4[Fire]+3[Cold]')).toEqual([{ label: 'Fire', value: 6 }, { label: 'Cold', value: 3 }]);
});
it('groups unlabeled results, including zero, as Other', () => {
  expect(breakdown('d6[Fire]+2+d4')).toEqual([{ label: 'Fire', value: 4 }, { label: 'Other', value: 5 }]);
  expect(breakdown('d6[Fire]+0')).toEqual([{ label: 'Fire', value: 4 }, { label: 'Other', value: 0 }]);
});
it.each(['2d6+3', '2d6[Fire]', 'd6[Fire]+d4[Fire]', '(d6+3)[Fire]'])('omits redundant breakdowns for %s', formula => {
  expect(breakdown(formula)).toEqual([]);
});
it('uses saved kept-pool values instead of summing discarded faces or double-counting labeled children', () => {
  expect(breakdown('4d6kh3[Fire]+d4[Cold]')).toEqual([{ label: 'Fire', value: 12 }, { label: 'Cold', value: 3 }]);
  expect(breakdown('4d6kh3+1[Fire]')).toEqual([{ label: 'Fire', value: 1 }, { label: 'Other', value: 12 }]);
  expect(breakdown('(d6+3)[Fire]+d4[Cold]')).toEqual([{ label: 'Fire', value: 7 }, { label: 'Cold', value: 3 }]);
});
it('omits dropped groups and dice used for computed counts or rule thresholds', () => {
  expect(breakdown('{d6[Fire],d4[Cold]}kh1+2')).toEqual([{ label: 'Fire', value: 4 }, { label: 'Other', value: 2 }]);
  expect(breakdown('(d4[Count])d6[Fire]+1')).toEqual([{ label: 'Fire', value: 12 }, { label: 'Other', value: 1 }]);
});
it('applies scalar arithmetic to final-total contributions without counting multipliers as Other', () => {
  expect(breakdown('(d6[Fire]+d6[Cold])*2')).toEqual([{ label: 'Fire', value: 8 }, { label: 'Cold', value: 8 }]);
  expect(breakdown('d6[Fire]/2+d4[Cold]')).toEqual([{ label: 'Fire', value: 2 }, { label: 'Cold', value: 3 }]);
  expect(breakdown('2*(d6[Fire]+3)')).toEqual([{ label: 'Fire', value: 8 }, { label: 'Other', value: 6 }]);
  expect(breakdown('d6[Fire]*2')).toEqual([]);
  expect(breakdown('d6[Fire]-d4[Cold]')).toEqual([{ label: 'Fire', value: 4 }, { label: 'Cold', value: -3 }]);
});
it('splits inseparable mixed-label arithmetic and rounding proportionally', () => {
  expect(breakdown('2[Fire]*3[Cold]')).toEqual([{ label: 'Fire', value: 2.4 }, { label: 'Cold', value: 3.6 }]);
  expect(breakdown('floor((2[Fire]+3[Cold])/2)')).toEqual([{ label: 'Fire', value: .8 }, { label: 'Cold', value: 1.2 }]);
  expect(breakdown('(2[Fire]+3[Cold])**2')).toEqual([{ label: 'Fire', value: 10 }, { label: 'Cold', value: 15 }]);
});
it('keeps nonlinear zero-valued label contributions finite', () => {
  expect(breakdown('0[Fire]*0[Cold]')).toEqual([{ label: 'Fire', value: 0 }, { label: 'Cold', value: 0 }]);
});
it.each(['floor((d6[Fire]+d4[Cold])/2)', '(d6[Fire]+3)*d4[Cold]', '(d6[Fire]-d4[Cold])**2'])('accounts for the entire saved total in %s', formula => {
  const roll = evaluateDice(formula, () => .5);
  const parts = labelBreakdown(roll.node);
  expect(parts.reduce((sum, part) => sum + part.value, 0)).toBeCloseTo(roll.node.value, 12);
});
