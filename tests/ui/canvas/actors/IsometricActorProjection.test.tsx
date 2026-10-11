import { fireEvent, render, screen, act } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { ActorLayer } from '@ui/canvas/actors/ActorLayer';
import { CanvasSettings } from '@ui/settings/CanvasSettings';
import { CANVAS_PREFERENCES_KEY } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';
import { createActor, createZone, collection } from './actorLayerTestFixtures';

beforeEach(() => {
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
});

it.each(['circle', 'rectangle'] as const)('projects %s artwork and outlines while retaining upright labels and hit geometry', shape => {
  const zone = createZone(), actor = { ...createActor(zone.id), shape };
  const encounter = { ...createEncounterState({ id: 'iso', name: 'Iso' }), actors: collection([actor]), zones: collection([zone]) };
  encounter.grid.type = 'isometric'; encounter.grid.rotation = 31;
  const before = structuredClone(encounter);
  function view() {
    return <><CanvasSettings /><svg><ActorLayer encounter={encounter} placements={[{ actor, point: { x: 192, y: 192 }, radius: 30 }]}
      actorDrag={null} backgroundLuminanceByZoneId={{ [zone.id]: 0 }} canvasBackgroundLuminance={255}
      onActorMouseEnter={() => undefined} onActorMouseLeave={() => undefined}
      selection={{ selectedEntityType: 'actor', selectedIds: [actor.id], overlayTargets: [] }} showFactionOutlines /></svg></>;
  }
  const { container, rerender } = render(view());
  const toggle = screen.getByRole('switch', { name: 'Project tokens on isometric grids' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(container.querySelector('[data-isometric-projection]')).toBeNull();
  fireEvent.click(toggle);
  expect(container.querySelectorAll('[data-isometric-projection]')).toHaveLength(2);
  const hit = container.querySelector('[data-actor-logical-hit-area]')!;
  expect(hit.tagName).toBe(shape === 'circle' ? 'circle' : 'rect');
  expect(hit.getAttribute(shape === 'circle' ? 'r' : 'width')).toBe(shape === 'circle' ? '30' : '60');
  expect(screen.getByText('AEGIS').closest('[data-isometric-projection]')).toBeNull();
  expect(encounter).toEqual(before);
  encounter.grid.type = 'square';
  rerender(view());
  expect(container.querySelector('[data-isometric-projection]')).toBeNull();
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  encounter.grid.type = 'isometric'; rerender(view());
  expect(container.querySelector('[data-isometric-projection]')).not.toBeNull();
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
  expect(container.querySelector('[data-isometric-projection]')).toBeNull();
});
