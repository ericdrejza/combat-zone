import type { LibraryNode, LibrarySection } from "@library/types";

export function getNodeChildren(
  section: LibrarySection,
  folderId: string
): LibraryNode[] {
  const folder = section.nodesById[folderId];

  if (!folder || folder.type !== "folder") {
    return [];
  }

  return (folder.childIds ?? [])
    .map((childId) => section.nodesById[childId])
    .filter((node): node is LibraryNode => Boolean(node));
}

export function getFoldersFirstChildren(
  section: LibrarySection,
  folderId: string
): LibraryNode[] {
  return [...getNodeChildren(section, folderId)].sort((left, right) => {
    if (left.type === "folder" && right.type !== "folder") {
      return -1;
    }

    if (left.type !== "folder" && right.type === "folder") {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getAlphabetizedChildren(
  section: LibrarySection,
  folderId: string
): LibraryNode[] {
  return [...getNodeChildren(section, folderId)].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

/** Returns a folder's full root-to-folder path for expanding the explorer. */
export function getFolderAncestorIds(
  section: LibrarySection,
  folderId: string
): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  let current: LibraryNode | undefined = section.nodesById[folderId];

  while (current?.type === "folder" && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current.id);
    current = current.parentId
      ? section.nodesById[current.parentId]
      : undefined;
  }

  return path;
}

export function getImageNodes(section: LibrarySection): LibraryNode[] {
  return Object.values(section.nodesById)
    .filter((node) => node.type === "image")
    .sort((left, right) => left.name.localeCompare(right.name));
}
