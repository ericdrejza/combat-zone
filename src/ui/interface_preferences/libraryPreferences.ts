import { LIBRARY_SECTION_IDS, type LibrarySectionId } from "@library/types";

export type LibraryViewDefault = "grid" | "list";
export type LibraryGridCardSizes = Record<LibrarySectionId, number>;
export const LIBRARY_GRID_CARD_MIN = 80;
export const LIBRARY_GRID_CARD_MAX = 256;
export const DEFAULT_LIBRARY_GRID_CARD_SIZE = 128;
export const DEFAULT_LIBRARY_GRID_CARD_SIZES: LibraryGridCardSizes = {
  encounters: DEFAULT_LIBRARY_GRID_CARD_SIZE,
  backgrounds: DEFAULT_LIBRARY_GRID_CARD_SIZE,
  tokens: DEFAULT_LIBRARY_GRID_CARD_SIZE,
  audio: DEFAULT_LIBRARY_GRID_CARD_SIZE
};

export function readLibraryViewDefault(value: unknown): LibraryViewDefault {
  return value === "list" ? "list" : "grid";
}

export function readLibraryGridCardSize(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= LIBRARY_GRID_CARD_MIN && value <= LIBRARY_GRID_CARD_MAX ? Math.round(value) : DEFAULT_LIBRARY_GRID_CARD_SIZE;
}

export function readLibraryGridCardSizes(value: unknown): LibraryGridCardSizes {
  const stored = value && typeof value === "object" ? value as Partial<LibraryGridCardSizes> : {};
  return Object.fromEntries(LIBRARY_SECTION_IDS.map((id) => [id, readLibraryGridCardSize(stored[id])])) as LibraryGridCardSizes;
}

/** Both Library containers derive their active width from the same preferences. */
export function resolveLibraryGridCardSize(preferences: {
  libraryIndependentGridCardSizes: boolean;
  libraryGridCardSize: number;
  libraryGridCardSizes: LibraryGridCardSizes;
}, sectionId: LibrarySectionId): number {
  return preferences.libraryIndependentGridCardSizes ? preferences.libraryGridCardSizes[sectionId] : preferences.libraryGridCardSize;
}
