import { act, fireEvent, screen, within } from '@testing-library/react';
import { COMPACT_LAYOUT_QUERY } from '@hooks/useCompactLayout';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { commitEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { renderApp, getCanvas, mockCanvasBounds, createRectangleZone } from '@tests/ui/renderApp';

it('keeps history beside the desktop toggle and available after collapsing or emptying the left dock', () => {
  renderApp();
  const left = screen.getByLabelText('left sidebar');
  const toggle = within(left).getByRole('button', { name: 'Collapse left sidebar' });
  const history = within(left).getByRole('group', { name: 'Encounter history' });
  expect(toggle.parentElement?.nextElementSibling).toBe(history);
  expect(within(history).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(['Undo', 'Redo']);
  fireEvent.click(toggle);
  expect(within(left).getByRole('button', { name: 'Expand left sidebar' })).toBeInTheDocument();
  expect(within(left).getByRole('group', { name: 'Encounter history' })).toBeInTheDocument();
  act(() => {
    const current = store.getState().encounter.present;
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('panel.move'), nextEncounter: { ...current, panelLayout: { left: [], right: [...current.panelLayout.right, ...current.panelLayout.left] } } }));
  });
  expect(within(left).queryByRole('button', { name: /left sidebar/ })).not.toBeInTheDocument();
  expect(within(left).getByRole('button', { name: 'Undo' })).toBeEnabled();
});
it('places history in the compact canvas without requiring a sidebar', () => {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ addEventListener: vi.fn(), removeEventListener: vi.fn(), matches: query === COMPACT_LAYOUT_QUERY, media: query, onchange: null }));
  try {
    renderApp();
    expect(screen.queryByLabelText('left sidebar')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Encounter canvas')).getByRole('group', { name: 'Encounter history' })).toBeInTheDocument();
  } finally { window.matchMedia = original; }
});
it('blocks history through a drawing draft, then permits replay after the drawing commits', async () => {
  renderApp();
  const canvas = getCanvas(); mockCanvasBounds(canvas);
  createRectangleZone(canvas);
  await screen.findByLabelText('Zone 1');
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  fireEvent.mouseDown(canvas, { button: 0, clientX: 300, clientY: 100 });
  fireEvent.mouseMove(canvas, { clientX: 450, clientY: 250 });
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(store.getState().encounter.present.zones.allIds).toHaveLength(1);
  fireEvent.mouseUp(canvas);
  await screen.findByLabelText('Zone 2');
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(store.getState().encounter.present.zones.allIds).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(store.getState().encounter.present.zones.allIds).toHaveLength(2);
});
