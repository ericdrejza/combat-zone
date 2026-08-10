import type { EntityCollection } from "@core/state/entityCollection";

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}
