import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode, LibrarySection } from "@library/types";

/** Traverses folder order without following links into other directories. */
export function getDirectoryAudioNodes(library: LibrarySection, folder: LibraryNode, recursive: boolean): LibraryNode[] {
  const visited = new Set<string>();
  const nodes: LibraryNode[] = [];
  function visit(node: LibraryNode) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    for (const id of node.childIds ?? []) {
      const child = library.nodesById[id];
      if (!child) continue;
      if (child.type === "folder") {
        if (recursive) visit(child);
      } else if (resolveLibraryAsset(library, child.id)) nodes.push(child);
    }
  }
  visit(folder);
  return nodes;
}
