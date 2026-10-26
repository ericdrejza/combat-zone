import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { setActiveTool } from '@interaction/interactionState';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { renderApp } from '@tests/ui/renderApp';

it.each(['ADVISORY', 'STRICT'] as const)('keeps keyboard cell-size replacement responsive with snapped actors in %s', async mode => {
  const user = userEvent.setup();
  renderApp();
  let encounter = createZone(createEncounterState({ id: 'keyboard-grid', name: 'Keyboard grid' }), {
    id: 'zone', polygon: [{ x: 64, y: 64 }, { x: 896, y: 64 }, { x: 896, y: 576 }, { x: 64, y: 576 }]
  });
  encounter = createActor(encounter, { id: 'actor', currentZoneId: 'zone' });
  encounter.grid.visible = true;
  encounter.movementRules.snapToGrid = true;
  encounter.validationState.mode = mode;
  act(() => { store.dispatch(loadEncounterState(encounter)); store.dispatch(setActiveTool('grid')); });
  await user.click(screen.getByRole('button', { name: 'Grid settings' }));
  let dialog = within(screen.getByRole('dialog', { name: 'Grid settings' }));
  const field = dialog.getByRole('spinbutton', { name: 'Cell size' });
  await user.click(field);
  // A partial replacement must stay local until focus leaves the field.
  await user.keyboard('{End}{Backspace}');
  expect(field).toHaveValue(6);
  expect(store.getState().interaction.gridPreview?.cellSize).toBe(64);
  await user.keyboard('4');
  await user.clear(field);
  await user.type(field, '32');
  expect(field).toHaveValue(32);
  expect(store.getState().interaction.gridPreview?.cellSize).toBe(64);
  await user.tab();
  expect(store.getState().interaction.gridPreview?.cellSize).toBe(32);
  expect(store.getState().encounter.present).toEqual(encounter);
  expect(store.getState().encounter.past).toHaveLength(0);
  await user.click(dialog.getByRole('button', { name: 'Cancel' }));
  expect(store.getState().interaction.gridPreview).toBeNull();
  expect(store.getState().encounter.present).toEqual(encounter);

  await user.click(screen.getByRole('button', { name: 'Grid settings' }));
  dialog = within(screen.getByRole('dialog', { name: 'Grid settings' }));
  await user.clear(dialog.getByRole('spinbutton', { name: 'Cell size' }));
  await user.type(dialog.getByRole('spinbutton', { name: 'Cell size' }), '32');
  await user.click(dialog.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(store.getState().encounter.present.grid.cellSize).toBe(32));
  const saved = store.getState().encounter.present;
  expect(store.getState().encounter.past).toHaveLength(1);
  expect(saved.actors.byId.actor.currentZoneId).toBe('zone');
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(encounter);
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(saved);
});
