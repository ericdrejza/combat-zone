import { ZONELESS_ACTOR_ZONE_ID, type EncounterState } from '@core/encounter/types';
import type { EncounterActionRecord } from '@core/history/types';
import { resolveMembership, type MembershipChoice } from './zoneMembership';
import { readCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { requestMembershipChoice } from '@ui/membership/membershipChoices';

/** Coordinates or Zone edits trigger membership; unrelated properties do not. */
export function reconcileMembership(current: EncounterState, next: EncounterState, action: EncounterActionRecord): EncounterState | Promise<EncounterState | null> {
  if (next.movementRules.zoneLocked) return next;
  const zoneChanged = current.zones !== next.zones;
  const byId = { ...next.actors.byId }, preferences = readCanvasPreferences();
  const pending: { id: string; choice: MembershipChoice }[] = [];
  let changed = false;
  for (const id of next.actors.allIds) {
    const actor = next.actors.byId[id], previous = current.actors.byId[id];
    const point = actor.spatialPosition;
    if (!zoneChanged && previous?.spatialPosition?.x === point?.x && previous?.spatialPosition?.y === point?.y && action.type !== 'movement.updateRules') continue;
    const resolution = point ? resolveMembership(next, actor, point, preferences) : ZONELESS_ACTOR_ZONE_ID;
    if (typeof resolution !== 'string') { pending.push({ id, choice: resolution }); continue; }
    if (resolution !== actor.currentZoneId) { byId[id] = { ...actor, currentZoneId: resolution }; changed = true; }
  }
  const result = () => changed ? { ...next, actors: { ...next.actors, byId } } : next;
  if (!pending.length) return result();
  return (async () => {
    for (const item of pending) {
      let resolution: string | MembershipChoice = item.choice;
      while (typeof resolution !== 'string') {
        const response = await requestMembershipChoice({ ...resolution, snapshot: current, actorName: byId[item.id].name, hasFallback: resolution.nextDecider < preferences.deciders.length });
        if (!response) return null;
        resolution = response === 'fallback' ? resolveMembership(next, byId[item.id], byId[item.id].spatialPosition!, preferences, resolution.candidates, resolution.nextDecider) : response;
      }
      byId[item.id] = { ...byId[item.id], currentZoneId: resolution }; changed = true;
    }
    return result();
  })();
}
