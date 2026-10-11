import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { store } from '@store/store';
import { undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { createRectangleZone, getCanvas, mockCanvasBounds, renderApp, selectZoneTool } from '@tests/ui/renderApp';

async function setup() {
  const user = userEvent.setup();
  renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
  await selectZoneTool(user); createRectangleZone(canvas);
  const zone = await screen.findByLabelText('Zone 1');
  return { user, zoneId: zone.getAttribute('data-entity-id')! };
}

it('opens on field click, closes on a repeat click, and shows the saved color without mutations', async () => {
  const { user, zoneId } = await setup();
  const before = store.getState().encounter;
  const field = screen.getByRole('button', { name: 'Fill color' });
  expect(field).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('img', { name: 'Fill color preview #ffffff' })).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Fill color palette' })).not.toBeInTheDocument();
  await user.click(field);
  expect(screen.getByRole('group', { name: 'Fill color palette' })).toBeInTheDocument();
  await user.click(field);
  expect(screen.queryByRole('group', { name: 'Fill color palette' })).not.toBeInTheDocument();
  expect(field).toHaveAttribute('aria-expanded', 'false');
  expect(store.getState().encounter).toEqual(before);
  expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe('#ffffff');
});

it('closes on selection, updates the field preview, and restores it through undo/redo', async () => {
  const { user, zoneId } = await setup();
  const before = store.getState().encounter;
  await user.click(screen.getByRole('button', { name: 'Fill color' }));
  await user.click(screen.getByRole('button', { name: 'Fill color #365314' }));
  expect(screen.queryByRole('group', { name: 'Fill color palette' })).not.toBeInTheDocument();
  await waitFor(() => expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe('#365314'));
  expect(screen.getByRole('img', { name: 'Fill color preview #365314' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Fill color' })).toHaveFocus();
  expect(store.getState().encounter.past).toHaveLength(before.past.length + 1);
  const saved = store.getState().encounter.present;
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(before.present);
  expect(screen.getByRole('img', { name: 'Fill color preview #ffffff' })).toBeInTheDocument();
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(saved);
  expect(screen.getByRole('img', { name: 'Fill color preview #365314' })).toBeInTheDocument();
});

it('provides collapsed Border and Engagement fields and honors Match border color', async () => {
  const { user } = await setup();
  await user.click(screen.getByRole('tab', { name: 'Border' }));
  await user.click(screen.getByRole('button', { name: 'Border color' }));
  await user.click(screen.getByRole('button', { name: 'Border color #1d4ed8' }));
  await waitFor(() => expect(screen.getByRole('img', { name: 'Border color preview #1d4ed8' })).toBeInTheDocument());
  expect(screen.queryByRole('group', { name: 'Border color palette' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Engagements' }));
  expect(screen.getByRole('button', { name: 'Engagements color' })).toBeDisabled();
  expect(screen.getByRole('img', { name: 'Engagements color preview #1d4ed8' })).toBeInTheDocument();
  await user.click(screen.getByRole('switch', { name: 'Match border color' }));
  await user.click(screen.getByRole('button', { name: 'Engagements color' }));
  await user.click(screen.getByRole('button', { name: 'Engagements color #bfdbfe' }));
  await waitFor(() => expect(screen.getByRole('img', { name: 'Engagements color preview #bfdbfe' })).toBeInTheDocument());
  expect(screen.queryByRole('group', { name: 'Engagements color palette' })).not.toBeInTheDocument();
});
