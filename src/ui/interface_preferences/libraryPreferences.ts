import { LIBRARY_SECTION_IDS, type LibrarySectionId } from "@library/types";

export type LibraryViewDefault = "grid" | "list";
export type LibraryPanelViewMode = "list" | "one-column" | "two-column";
export const LIBRARY_CARD_SIZE_STEPS = [
  { label: "Small", width: 80 },
  { label: "Medium", width: 128 },
  { label: "Large", width: 192 },
  { label: "Extra large", width: 256 }
] as const;

/** Legacy panel grids become two columns; panel views never use modal card sizing. */
export function readLibraryPanelViewDefault(value: unknown): LibraryPanelViewMode {
  return value === "list" || value === "one-column" ? value : "two-column";
}

export function nextLibraryPanelView(view: LibraryPanelViewMode): LibraryPanelViewMode {
  return view === "list" ? "one-column" : view === "one-column" ? "two-column" : "list";
}
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
  if (typeof value !== "number" || !Number.isFinite(value) || value < LIBRARY_GRID_CARD_MIN || value > LIBRARY_GRID_CARD_MAX) {
    return DEFAULT_LIBRARY_GRID_CARD_SIZE;
  }
  // Snap saved pixel preferences to the closest named step when loading older settings.
  return LIBRARY_CARD_SIZE_STEPS.reduce<number>((nearest, step) =>
    Math.abs(step.width - value) < Math.abs(nearest - value) ? step.width : nearest,
    DEFAULT_LIBRARY_GRID_CARD_SIZE
  );
}

export function readLibraryGridCardSizes(value: unknown): LibraryGridCardSizes {
  const stored = value && typeof value === "object" ? value as Partial<LibraryGridCardSizes> : {};
  return Object.fromEntries(LIBRARY_SECTION_IDS.map((id) => [id, readLibraryGridCardSize(stored[id])])) as LibraryGridCardSizes;
}

/** The Library modal derives its active minimum card width from these preferences. */
export function resolveLibraryGridCardSize(preferences: {
  libraryIndependentGridCardSizes: boolean;
  libraryGridCardSize: number;
  libraryGridCardSizes: LibraryGridCardSizes;
}, sectionId: LibrarySectionId): number {
  return preferences.libraryIndependentGridCardSizes ? preferences.libraryGridCardSizes[sectionId] : preferences.libraryGridCardSize;
}
