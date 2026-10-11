import type { EncounterState } from '@core/encounter/types';
import type { MembershipChoice } from '@core/movement/zoneMembership';
export type MembershipRequest = MembershipChoice & { snapshot: EncounterState; actorName: string; hasFallback: boolean; resolve: (result: string | 'fallback' | null) => void };
let listener: ((request: MembershipRequest) => void) | undefined;
/** UI decisions stay outside domain reducers and worker validation. */
export function subscribeMembershipChoices(callback: (request: MembershipRequest) => void) {
  listener = callback;
  return () => { if (listener === callback) listener = undefined; };
}
export function requestMembershipChoice(request: Omit<MembershipRequest, 'resolve'>): Promise<string | null> {
  if (!listener) return Promise.resolve(null);
  return new Promise(resolve => listener!({ ...request, resolve }));
}
