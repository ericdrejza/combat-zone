import type { EncounterState } from '../encounter/types';
import { doPolygonsOverlap } from '../layout/polygonCollision';
import type {
  ValidationAction,
  ValidationMessage,
  ValidationResult,
  Validator
} from './types';

function result(messages: ValidationMessage[]): ValidationResult {
  return {
    valid: messages.every((message) => message.severity !== 'error'),
    messages
  };
}

function polygonsEqual(
  first: EncounterState['zones']['byId'][string]['polygon'] | undefined,
  second: EncounterState['zones']['byId'][string]['polygon'] | undefined
): boolean {
  return Boolean(
    first &&
      second &&
      first.length === second.length &&
      first.every(
        (point, index) =>
          point.x === second[index]?.x && point.y === second[index]?.y
      )
  );
}

function getChangedZoneIds(
  action: ValidationAction,
  state: EncounterState,
  nextState: EncounterState
): string[] {
  if (action.type === 'zone.create' || action.type === 'zone.reshape') {
    const zoneId = [action.payload.zoneId, action.payload.id].find(
      (value): value is string => typeof value === 'string'
    );

    return zoneId ? [zoneId] : [];
  }

  if (
    action.type === 'canvas.resize' ||
    action.type === 'background.add' ||
    action.type === 'background.replace'
  ) {
    return nextState.zones.allIds.filter(
      (zoneId) =>
        !polygonsEqual(
          state.zones.byId[zoneId]?.polygon,
          nextState.zones.byId[zoneId]?.polygon
        )
    );
  }

  if (
    action.type !== 'actor.create' &&
    action.type !== 'actor.move' &&
    action.type !== 'actor.moveMany' &&
    action.type !== 'actor.paint' &&
    action.type !== 'actor.updateProperties'
  ) {
    return [];
  }

  return nextState.zones.allIds.filter((zoneId) => {
    return !polygonsEqual(
      state.zones.byId[zoneId]?.polygon,
      nextState.zones.byId[zoneId]?.polygon
    );
  });
}

/** Blocks committed zone geometry that overlaps another zone. */
export const ZoneOverlapValidator: Validator<EncounterState> = {
  id: 'ZoneOverlapValidator',
  runsInOffMode: true,
  validate(action, { state, nextState }) {
    if (!nextState) {
      return result([]);
    }

    const changedZoneIds = getChangedZoneIds(action, state, nextState);
    const messages: ValidationMessage[] = [];

    for (const zoneId of changedZoneIds) {
      const zone = nextState.zones.byId[zoneId];

      if (!zone) {
        continue;
      }

      for (const otherZoneId of nextState.zones.allIds) {
        if (zoneId === otherZoneId) {
          continue;
        }

        const otherZone = nextState.zones.byId[otherZoneId];

        if (otherZone && doPolygonsOverlap(zone.polygon, otherZone.polygon)) {
          messages.push({
            code: 'zone.overlap',
            message: `Zone ${zone.name} overlaps zone ${otherZone.name}.`,
            severity: 'error'
          });
          break;
        }
      }
    }

    return {
      ...result(messages),
      blocked: messages.length > 0
    };
  }
};
