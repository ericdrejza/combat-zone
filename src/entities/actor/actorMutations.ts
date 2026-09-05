import type {
  Actor,
  ActorLayoutGroup,
  ActorShape,
  ActorSize,
  ActorType
} from './types';
import type {
  ActorZoneAssignment,
  EncounterState
} from '@core/encounter/types';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { EntityCollection, EntityId } from '@core/state/entityCollection';
import { removeActorsFromEngagements } from '@entities/engagement/engagementMutations';
import { removeActorFromInitiative } from '@core/encounter/initiativeMutations';
import type { ImageAssetSource } from '@core/assets/imageAssetSource';

export type ActorImageInput = {
  libraryNodeId?: string;
  source: ImageAssetSource;
  mediaType: string;
  name: string;
};

export type CreateActorInput = {
  actorType?: ActorType;
  currentZoneId: ActorZoneAssignment;
  id: EntityId;
  image?: ActorImageInput;
  layoutGroup?: ActorLayoutGroup;
  name?: string;
  shape?: ActorShape;
  size?: ActorSize;
};

export type UpdateActorPropertiesInput = {
  actorType?: ActorType;
  image?: ImageAssetSource;
  imageLibraryNodeId?: string | null;
  layoutGroup?: ActorLayoutGroup;
  name?: string;
  shape?: ActorShape;
  size?: ActorSize;
};

function upsertEntity<TEntity extends { id: EntityId }>(
  collection: EntityCollection<TEntity>,
  entity: TEntity
): EntityCollection<TEntity> {
  return {
    byId: {
      ...collection.byId,
      [entity.id]: entity
    },
    allIds: collection.allIds.includes(entity.id)
      ? collection.allIds
      : [...collection.allIds, entity.id]
  };
}

function removeEntity<TEntity extends { id: EntityId }>(
  collection: EntityCollection<TEntity>,
  entityId: EntityId
): EntityCollection<TEntity> {
  if (!collection.byId[entityId]) {
    return collection;
  }

  const byId = { ...collection.byId };
  delete byId[entityId];

  return {
    byId,
    allIds: collection.allIds.filter((id) => id !== entityId)
  };
}

function moveEntityToCollectionEnd<TEntity extends { id: EntityId }>(
  collection: EntityCollection<TEntity>,
  entity: TEntity
): EntityCollection<TEntity> {
  return {
    byId: {
      ...collection.byId,
      [entity.id]: entity
    },
    allIds: [...collection.allIds.filter((id) => id !== entity.id), entity.id]
  };
}

function removeActorFromEngagements(
  state: EncounterState,
  actorId: EntityId
): EncounterState['engagements'] {
  const byId: EncounterState['engagements']['byId'] = {};
  const allIds: EntityId[] = [];

  for (const engagementId of state.engagements.allIds) {
    const engagement = state.engagements.byId[engagementId];

    if (!engagement) {
      continue;
    }

    const participantIds = engagement.participantIds.filter(
      (id) => id !== actorId
    );

    if (participantIds.length < 2) {
      continue;
    }

    byId[engagementId] = {
      ...engagement,
      participantIds
    };
    allIds.push(engagementId);
  }

  return {
    byId,
    allIds
  };
}

function getDefaultActorName(image?: ActorImageInput): string {
  return image?.name ?? 'Actor';
}

export function buildActor({
  actorType = 'creature',
  currentZoneId,
  id,
  image,
  layoutGroup = 'neutral',
  name,
  shape = 'circle',
  size = 'medium'
}: CreateActorInput): Actor {
  return {
    actorType,
    currentZoneId,
    id,
    image: image?.source,
    layoutGroup,
    metadata: {
      sourceLibraryNodeId: image?.libraryNodeId,
      sourceAssetName: image?.name,
      sourceAssetMediaType: image?.mediaType
    },
    name: name ?? getDefaultActorName(image),
    shape,
    size,
    statusEffects: []
  };
}

export function createActor(
  state: EncounterState,
  input: CreateActorInput
): EncounterState {
  return {
    ...state,
    actors: upsertEntity(state.actors, buildActor(input))
  };
}

export function moveActor(
  state: EncounterState,
  actorId: EntityId,
  destinationZoneId: ActorZoneAssignment
): EncounterState {
  const actor = state.actors.byId[actorId];

  if (!actor) {
    return state;
  }

  if (actor.currentZoneId === destinationZoneId) {
    return state;
  }

  const moved = {
    ...state,
    actors: moveEntityToCollectionEnd(state.actors, {
      ...actor,
      currentZoneId: destinationZoneId
    })
  };
  // A bare zone drop is an explicit disengage; joining/creating engagements
  // uses the engagement mutation, which keeps membership authoritative there.
  return removeActorsFromEngagements(moved, [actorId]);
}

export function updateActorProperties(
  state: EncounterState,
  actorId: EntityId,
  properties: UpdateActorPropertiesInput
): EncounterState {
  const actor = state.actors.byId[actorId];

  if (!actor) {
    return state;
  }

  const { imageLibraryNodeId, ...actorProperties } = properties;
  const metadata = { ...actor.metadata };
  if (imageLibraryNodeId === null) {
    delete metadata.sourceLibraryNodeId;
  } else if (imageLibraryNodeId !== undefined) {
    metadata.sourceLibraryNodeId = imageLibraryNodeId;
  }

  return {
    ...state,
    actors: upsertEntity(state.actors, {
      ...actor,
      ...actorProperties,
      metadata
    })
  };
}

export function deleteActor(
  state: EncounterState,
  actorId: EntityId
): EncounterState {
  if (!state.actors.byId[actorId]) {
    return state;
  }

  const withoutInitiativeActor = removeActorFromInitiative(state, actorId);

  return {
    ...withoutInitiativeActor,
    actors: removeEntity(state.actors, actorId),
    engagements: removeActorFromEngagements(state, actorId),
  };
}

export function duplicateActor(
  state: EncounterState,
  sourceActorId: EntityId,
  duplicateActorId: EntityId,
  destinationZoneId?: ActorZoneAssignment
): EncounterState {
  const sourceActor = state.actors.byId[sourceActorId];

  if (!sourceActor) {
    return state;
  }

  return {
    ...state,
    actors: upsertEntity(state.actors, {
      ...sourceActor,
      currentZoneId: destinationZoneId ?? sourceActor.currentZoneId,
      id: duplicateActorId,
      name: `${sourceActor.name} Copy`
    })
  };
}

export function getActorDestinationOrZoneless(
  zoneId: string | undefined
): ActorZoneAssignment {
  return zoneId ?? ZONELESS_ACTOR_ZONE_ID;
}
