/** Add/remove shifts do not dirty untouched neighbors; explicit reordering and field edits do. */
export function configurableDraftChanges<T extends { id: string }>(originals: T[], entries: T[]): Set<string> {
  const before = new Map(originals.map(item => [item.id, item]));
  const after = new Map(entries.map(item => [item.id, item]));
  const previousOrder = new Map(originals.filter(item => after.has(item.id)).map((item, index) => [item.id, index]));
  const currentOrder = new Map(entries.filter(item => before.has(item.id)).map((item, index) => [item.id, index]));
  return new Set([...before.keys(), ...after.keys()].filter(id =>
    JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)) || previousOrder.get(id) !== currentOrder.get(id)));
}
