/** Apply an editor's additions/removals to current tags after queued validation. */
export function applyTagChanges(current: string[], before: string[], after: string[]): string[] {
  const removed = before.filter((tag) => !after.includes(tag));
  const added = after.filter((tag) => !before.includes(tag));
  const next = current.filter((tag) => !removed.includes(tag));
  for (const tag of added) if (!next.includes(tag)) next.push(tag);
  return next.length === current.length && next.every((tag, index) => tag === current[index]) ? current : next;
}
