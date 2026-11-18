import type { EntityCollection } from "./entityCollection";
/** Rebase an editor's order while retaining concurrently added records. */
export function reorderCollection<T extends { id: string }>(collection: EntityCollection<T> | undefined, ids?: string[]): EntityCollection<T> | undefined {
  if (!collection || !ids) return collection;
  const ordered = [...new Set(ids)].filter(id => Object.prototype.hasOwnProperty.call(collection.byId, id));
  const allIds = [...ordered, ...collection.allIds.filter(id => !ordered.includes(id))];
  return allIds.every((id, i) => id === collection.allIds[i]) ? collection : { ...collection, allIds };
}
