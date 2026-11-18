import { expect, it } from "vitest";
import { configurableDraftChanges } from "@ui/controls/configurableDraftChanges";

const first = { id: 'first', name: 'Alpha' }, second = { id: 'second', name: 'Beta' };
it('counts only the added or removed item when unchanged neighbors shift', () => {
  expect([...configurableDraftChanges([first, second], [second])]).toEqual(['first']);
  expect([...configurableDraftChanges([second], [first, second])]).toEqual(['first']);
});
it('counts field edits and explicit reorder positions and clears reverted changes', () => {
  expect([...configurableDraftChanges([first, second], [{ ...first, name: 'Changed' }, second])]).toEqual(['first']);
  expect([...configurableDraftChanges([first, second], [second, first])]).toEqual(['first', 'second']);
  expect(configurableDraftChanges([first, second], [{ ...first }, { ...second }]).size).toBe(0);
});
