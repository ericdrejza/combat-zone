import type { EncounterState } from '@core/encounter/types';
import type { EntityId } from '@core/state/entityCollection';
import type { LayoutOrientation } from '@core/layout/types';
import type { Engagement } from './types';

export type EngagementProperties = Partial<Pick<
  Engagement,
  'layoutOrientation' | 'layoutStrategy'
>>;

type CreateEngagementInput = {
  id: EntityId;
  parentZoneId: EntityId;
  participantIds: EntityId[];
  layoutOrientation?: LayoutOrientation;
  layoutStrategy?: Engagement['layoutStrategy'];
};

function uniqueIds(ids: readonly EntityId[]): EntityId[] {
  return [...new Set(ids)];
}

/** Removes members and dissolves groups which no longer have melee meaning. */
export function removeActorsFromEngagements(
  state: EncounterState,
  actorIds: readonly EntityId[],
  exceptEngagementId?: EntityId
): EncounterState {
  const removedIds = new Set(actorIds);
  let changed = false;
  const byId: EncounterState['engagements']['byId'] = {};
  const allIds: EntityId[] = [];

  for (const engagementId of state.engagements.allIds) {
    const engagement = state.engagements.byId[engagementId];
    if (!engagement) continue;
    const participantIds =
      engagementId === exceptEngagementId
        ? engagement.participantIds
        : engagement.participantIds.filter((id) => !removedIds.has(id));
    if (participantIds.length < 2) {
      changed = true;
      continue;
    }
    if (participantIds.length !== engagement.participantIds.length) changed = true;
    byId[engagementId] =
      participantIds === engagement.participantIds
        ? engagement
        : { ...engagement, participantIds };
    allIds.push(engagementId);
  }

  return changed ? { ...state, engagements: { byId, allIds } } : state;
}

function moveActorsToZone(
  state: EncounterState,
  actorIds: readonly EntityId[],
  parentZoneId: EntityId
): EncounterState {
  const ids = new Set(actorIds);
  let changed = false;
  const byId = { ...state.actors.byId };
  let allIds = state.actors.allIds;
  for (const actorId of actorIds) {
    const actor = byId[actorId];
    if (!actor) continue;
    if (actor.currentZoneId !== parentZoneId) {
      byId[actorId] = { ...actor, currentZoneId: parentZoneId };
      changed = true;
    }
  }
  if (changed) allIds = [...allIds.filter((id) => !ids.has(id)), ...actorIds.filter((id) => Boolean(byId[id]))];
  return changed ? { ...state, actors: { byId, allIds } } : state;
}

export function createEngagement(
  state: EncounterState,
  input: CreateEngagementInput
): EncounterState {
  const participantIds = uniqueIds(input.participantIds).filter((id) =>
    Boolean(state.actors.byId[id])
  );
  if (participantIds.length < 2 || !state.zones.byId[input.parentZoneId]) return state;

  const withoutOldMembership = removeActorsFromEngagements(state, participantIds);
  const inParentZone = moveActorsToZone(
    withoutOldMembership,
    participantIds,
    input.parentZoneId
  );
  const engagement: Engagement = {
    id: input.id,
    parentZoneId: input.parentZoneId,
    participantIds,
    layoutOrientation: input.layoutOrientation ?? 'LEFT_RIGHT',
    layoutStrategy: input.layoutStrategy ?? 'FLEX'
  };
  return {
    ...inParentZone,
    engagements: {
      byId: { ...inParentZone.engagements.byId, [engagement.id]: engagement },
      allIds: inParentZone.engagements.allIds.includes(engagement.id)
        ? inParentZone.engagements.allIds
        : [...inParentZone.engagements.allIds, engagement.id]
    }
  };
}

/** Joins actors to a group, moving them into the group's zone in one snapshot. */
export function joinEngagement(
  state: EncounterState,
  engagementId: EntityId,
  actorIds: readonly EntityId[]
): EncounterState {
  const target = state.engagements.byId[engagementId];
  if (!target) return state;
  const joiningIds = uniqueIds(actorIds).filter((id) => Boolean(state.actors.byId[id]));
  const participantIds = uniqueIds([...target.participantIds, ...joiningIds]);
  const withoutOldMembership = removeActorsFromEngagements(
    state,
    joiningIds,
    engagementId
  );
  const inParentZone = moveActorsToZone(
    withoutOldMembership,
    joiningIds,
    target.parentZoneId
  );
  const current = inParentZone.engagements.byId[engagementId];
  if (!current) return inParentZone;
  if (participantIds.length === current.participantIds.length && inParentZone === state) return state;
  return {
    ...inParentZone,
    engagements: {
      ...inParentZone.engagements,
      byId: {
        ...inParentZone.engagements.byId,
        [engagementId]: { ...current, participantIds }
      }
    }
  };
}

export function mergeEngagements(
  state: EncounterState,
  sourceEngagementId: EntityId,
  targetEngagementId: EntityId
): EncounterState {
  const source = state.engagements.byId[sourceEngagementId];
  const target = state.engagements.byId[targetEngagementId];
  if (!source || !target || source.id === target.id) return state;
  return joinEngagement(state, target.id, source.participantIds);
}

/** Leaving is explicit because an actor can stay inside its zone but disengage. */
export function leaveEngagements(
  state: EncounterState,
  actorIds: readonly EntityId[]
): EncounterState {
  return removeActorsFromEngagements(state, actorIds);
}

/**
 * Moves actors while preserving every group whose complete membership is in
 * the dragged set. Partial groups still lose the moved participants.
 */
export function moveActorsPreservingCompleteEngagements(
  state: EncounterState,
  actorIds: readonly EntityId[],
  parentZoneId: EntityId
): EncounterState {
  if (!state.zones.byId[parentZoneId]) return state;
  const movedIds = new Set(actorIds);
  let next = moveActorsToZone(state, actorIds, parentZoneId);
  let changed = next !== state;
  const byId: EncounterState['engagements']['byId'] = {};
  const allIds: EntityId[] = [];

  for (const engagementId of next.engagements.allIds) {
    const engagement = next.engagements.byId[engagementId];
    if (!engagement) continue;
    const movesCompleteGroup = engagement.participantIds.every((actorId) =>
      movedIds.has(actorId)
    );
    const participantIds = movesCompleteGroup
      ? engagement.participantIds
      : engagement.participantIds.filter((actorId) => !movedIds.has(actorId));
    if (participantIds.length < 2) {
      changed = true;
      continue;
    }
    const updated =
      movesCompleteGroup && engagement.parentZoneId !== parentZoneId
        ? { ...engagement, parentZoneId }
        : participantIds.length !== engagement.participantIds.length
          ? { ...engagement, participantIds }
          : engagement;
    if (updated !== engagement) changed = true;
    byId[engagementId] = updated;
    allIds.push(engagementId);
  }

  if (!changed) return state;
  next = { ...next, engagements: { allIds, byId } };
  return next;
}

export function updateEngagementProperties(
  state: EncounterState,
  engagementId: EntityId,
  properties: EngagementProperties
): EncounterState {
  const engagement = state.engagements.byId[engagementId];
  if (!engagement) return state;
  const next = { ...engagement, ...properties };
  if (
    next.layoutOrientation === engagement.layoutOrientation &&
    next.layoutStrategy === engagement.layoutStrategy
  ) return state;
  return {
    ...state,
    engagements: {
      ...state.engagements,
      byId: { ...state.engagements.byId, [engagementId]: next }
    }
  };
}

/** Builds one new transitive group per zone from the current actor selection. */
export function engageSelectedActors(
  state: EncounterState,
  selectedActorIds: readonly EntityId[],
  createId: (zoneId: EntityId) => EntityId
): EncounterState {
  const idsByZone = new Map<EntityId, EntityId[]>();
  for (const actorId of uniqueIds(selectedActorIds)) {
    const actor = state.actors.byId[actorId];
    if (!actor || !state.zones.byId[actor.currentZoneId]) continue;
    const group = idsByZone.get(actor.currentZoneId) ?? [];
    group.push(actorId);
    idsByZone.set(actor.currentZoneId, group);
  }
  let next = state;
  for (const [zoneId, participantIds] of idsByZone) {
    if (participantIds.length >= 2) {
      next = createEngagement(next, { id: createId(zoneId), parentZoneId: zoneId, participantIds });
    }
  }
  return next;
}
