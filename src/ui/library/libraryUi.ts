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

export function getImageNodes(section: LibrarySection): LibraryNode[] {
  return Object.values(section.nodesById)
    .filter((node) => node.type === "image")
    .sort((left, right) => left.name.localeCompare(right.name));
}
