import type { LibraryNode, LibrarySectionId, LibraryState } from "@library/types";

const clone = <T>(value: T): T => structuredClone(value);
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const conflictName = (name: string) => name.endsWith("(Conflict copy)") ? name : `${name} (Conflict copy)`;

function descendants(rootId: string, nodes: Record<string, LibraryNode>, result: Set<string>) {
  if (result.has(rootId)) return;
  result.add(rootId);
  const node = nodes[rootId];
  if (node?.type === "folder") {
    for (const childId of node.childIds ?? []) descendants(childId, nodes, result);
  }
}

function nextConflictId(id: string, used: Set<string>): string {
  let candidate = `${id}-conflict`;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${id}-conflict-${suffix++}`;
  used.add(candidate);
  return candidate;
}

function rebuildChildren(sectionId: LibrarySectionId, state: LibraryState) {
  const section = state.sections[sectionId];
  for (const node of Object.values(section.nodesById)) {
    if (node.type === "folder") node.childIds = [];
  }
  for (const node of Object.values(section.nodesById)) {
    if (node.id === section.rootId) continue;
    if (!node.parentId || section.nodesById[node.parentId]?.type !== "folder") node.parentId = section.rootId;
    const parent = section.nodesById[node.parentId];
    if (parent?.type === "folder") parent.childIds!.push(node.id);
  }
}

/** Three-way merge that keeps remote IDs authoritative and clones conflicting local subtrees. */
export function mergeLibraryStates(
  base: LibraryState,
  local: LibraryState,
  remote: LibraryState
): { state: LibraryState; localConflictIds: Map<string, string> } {
  const state = clone(remote);
  const localConflictIds = new Map<string, string>();

  for (const sectionId of ["encounters", "backgrounds", "tokens"] as const) {
    const baseNodes = base.sections[sectionId].nodesById;
    const localNodes = local.sections[sectionId].nodesById;
    const remoteNodes = remote.sections[sectionId].nodesById;
    const output = state.sections[sectionId].nodesById;
    const cloneIds = new Set<string>();

    const ids = new Set([...Object.keys(baseNodes), ...Object.keys(localNodes), ...Object.keys(remoteNodes)]);
    for (const id of ids) {
      if (id === state.sections[sectionId].rootId) continue;
      const before = baseNodes[id];
      const localNode = localNodes[id];
      const remoteNode = remoteNodes[id];
      const localChanged = !same(before, localNode);
      const remoteChanged = !same(before, remoteNode);
      if (localChanged && remoteChanged && !same(localNode, remoteNode) && localNode) {
        descendants(id, localNodes, cloneIds);
      }
    }
    for (const id of ids) {
      if (id === state.sections[sectionId].rootId || cloneIds.has(id)) continue;
      const before = baseNodes[id];
      const localNode = localNodes[id];
      const remoteNode = remoteNodes[id];
      const localChanged = !same(before, localNode);
      const remoteChanged = !same(before, remoteNode);
      if (localChanged && !remoteChanged) {
        if (localNode) output[id] = clone(localNode);
        else delete output[id];
      }
    }

    const used = new Set([...Object.keys(output), ...Object.keys(localNodes)]);
    for (const id of cloneIds) localConflictIds.set(id, nextConflictId(id, used));
    for (const id of cloneIds) {
      const source = localNodes[id];
      if (!source) continue;
      const mappedId = localConflictIds.get(id)!;
      const mappedParent = source.parentId ? localConflictIds.get(source.parentId) ?? source.parentId : null;
      const parentId = mappedParent && output[mappedParent] ? mappedParent : state.sections[sectionId].rootId;
      output[mappedId] = {
        ...clone(source),
        id: mappedId,
        name: cloneIds.has(source.parentId ?? "") ? source.name : conflictName(source.name),
        parentId,
        ...(source.targetId ? { targetId: localConflictIds.get(source.targetId) ?? source.targetId } : {}),
        ...(source.type === "folder" ? { childIds: [] } : {})
      };
    }
    rebuildChildren(sectionId, state);
  }
  return { state, localConflictIds };
}
