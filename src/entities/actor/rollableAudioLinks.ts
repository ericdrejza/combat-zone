import type { Actor } from "./types";
/** Group removal/moves clear owned links without changing captured historical invocations. */
export function clearRollableAudioLink(actor: Actor, groupId: string): Actor {
  if (!actor.rollables?.allIds.some(id => actor.rollables!.byId[id].audioGroupId === groupId)) return actor;
  return { ...actor, rollables: { ...actor.rollables, byId: Object.fromEntries(actor.rollables.allIds.map(id => { const r = actor.rollables!.byId[id]; return [id, r.audioGroupId === groupId ? { ...r, audioGroupId: null } : r]; })) } };
}
