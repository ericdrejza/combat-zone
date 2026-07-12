export type LibrarySectionId = "encounters" | "backgrounds" | "tokens";

export type LibraryNodeType = "folder" | "image" | "link";

export type LibraryImageAsset = {
  dataUrl: string;
  mediaType: string;
  name: string;
};

export type LibraryNode = {
  id: string;
  name: string;
  parentId: string | null;
  sectionId: LibrarySectionId;
  type: LibraryNodeType;
  childIds?: string[];
  asset?: LibraryImageAsset;
  targetId?: string;
};

export type LibrarySection = {
  id: LibrarySectionId;
  name: string;
  rootId: string;
  nodesById: Record<string, LibraryNode>;
};

export type LibraryState = {
  sections: Record<LibrarySectionId, LibrarySection>;
};

export const LIBRARY_SECTION_IDS: LibrarySectionId[] = [
  "encounters",
  "backgrounds",
  "tokens"
];

export const LIBRARY_SECTION_LABELS: Record<LibrarySectionId, string> = {
  encounters: "Encounters",
  backgrounds: "Backgrounds",
  tokens: "Tokens"
};
