import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { clampCanvasResizeToValidLayout } from '@core/encounter/clampCanvasResize';
import { zoneSnappingValid } from '@core/movement/zoneVertexSnapping';

it('fits background sizing with Zone vertex snapping before validating resize candidates', () => {
  const state = createZone(createEncounterState({ id: 'background-snap', name: 'Background' }), { id: 'z', shape: 'polygon', polygon: [{ x: 64, y: 64 }, { x: 256, y: 64 }, { x: 256, y: 256 }, { x: 64, y: 256 }] });
  state.movementRules.snapZoneVertices = true;
  const result = clampCanvasResizeToValidLayout(state, state, { width: 800, height: 450 }, 450 / 640, 'background.add');
  expect(result.canvasSize).toEqual({ width: 800, height: 450 });
  expect(zoneSnappingValid(result.encounter, result.encounter.zones.byId.z)).toBe(true);
});
