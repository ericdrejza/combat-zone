import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone, updateZonePolygon } from '@entities/zone/zoneMutations';
import { ActorStatusValidator } from '@entities/actor/actorStatusValidator';
import { EdgeRouteDiagnosticValidator } from '@core/validation/edgeValidators';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/runtimeEncounterChange';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { ValidationMode } from '@core/validation/types';

function input(mode: ValidationMode) {
  const currentEncounter = createZone(createEncounterState({ id: 'immediate-move', name: 'Move' }), {
    id: 'z', polygon: [{ x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 192 }, { x: 64, y: 192 }]
  });
  currentEncounter.validationState.mode = mode;
  const polygon = currentEncounter.zones.byId.z.polygon.map(point => ({ x: point.x + 64, y: point.y }));
  return { currentEncounter, nextEncounter: updateZonePolygon(currentEncounter, 'z', polygon),
    action: createEncounterActionRecord('zone.move', { zoneId: 'z', polygon }) };
}

describe('rigid Zone move acceptance', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)('accepts before returning without routing Edges in %s mode', mode => {
    const diagnostics = vi.spyOn(EdgeRouteDiagnosticValidator, 'validate');
    const candidate = input(mode), prepared = prepareValidatedEncounterChangeForRuntime(candidate);
    expect(prepared).not.toBeInstanceOf(Promise);
    expect(prepared).toMatchObject({ blocked: false, nextEncounter: { zones: candidate.nextEncounter.zones } });
    expect(diagnostics).not.toHaveBeenCalled();
  });

  it.each([['STRICT', true], ['ADVISORY', false]] as const)('retains %s policy blocking', (mode, blocked) => {
    vi.spyOn(ActorStatusValidator, 'validate').mockReturnValue({ valid: false, messages: [
      { code: 'test.policy', message: 'Policy violation', severity: 'error' }
    ] });
    const prepared = prepareValidatedEncounterChangeForRuntime(input(mode));
    expect(prepared).toMatchObject({ blocked, validationResult: { mode } });
  });
});
