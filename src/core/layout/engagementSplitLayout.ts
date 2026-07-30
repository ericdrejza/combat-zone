import type { EncounterState } from '@core/encounter/types';
import { toNestingActor } from './actorFootprints';

/** Shared split grouping so render and validation reserve identical sections. */
export function getEngagementAwareSplitInput(state: EncounterState, zoneId: string) {
  const engagements = state.engagements.allIds.flatMap((id) => {
    const engagement = state.engagements.byId[id];
    return engagement?.parentZoneId === zoneId ? [engagement] : [];
  });
  const engagementSectionByActor = new Map<string, string>();
  engagements.forEach((engagement) => engagement.participantIds.forEach((actorId) => engagementSectionByActor.set(actorId, `engagement-${engagement.id}`)));
  const actors = state.actors.allIds.flatMap((actorId) => {
    const actor = state.actors.byId[actorId];
    return actor?.currentZoneId === zoneId ? [{ ...toNestingActor(actor), splitSectionId: engagementSectionByActor.get(actor.id) ?? actor.layoutGroup }] : [];
  });
  return { actors, splitSectionOrder: ['hero', ...engagements.map((engagement) => `engagement-${engagement.id}`), 'neutral', 'enemy'] };
}
