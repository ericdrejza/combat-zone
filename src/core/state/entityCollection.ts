export type EntityId = string;

export type EntityWithId = {
  id: EntityId;
};

export type EntityCollection<TEntity extends EntityWithId> = {
  byId: Record<EntityId, TEntity>;
  allIds: EntityId[];
};

export function createEmptyEntityCollection<TEntity extends EntityWithId>(): EntityCollection<TEntity> {
  return {
    byId: {},
    allIds: []
  };
}

export function getEntityById<TEntity extends EntityWithId>(
  collection: EntityCollection<TEntity>,
  id: EntityId
): TEntity | undefined {
  return collection.byId[id];
}

export function getEntities<TEntity extends EntityWithId>(
  collection: EntityCollection<TEntity>
): TEntity[] {
  return collection.allIds.map((id) => collection.byId[id]).filter(Boolean);
}
