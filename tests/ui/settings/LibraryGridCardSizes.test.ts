import { describe, expect, it } from "vitest";
import { LIBRARY_SECTION_IDS } from "@library/types";
import { readLibraryGridCardSizes, resolveLibraryGridCardSize, readLibraryGridCardSize, readLibraryPanelViewDefault } from "@ui/interface_preferences/libraryPreferences";

describe("Library grid size selection", () => {
  const sizes = { encounters: 80, backgrounds: 128, tokens: 192, audio: 256 };
  it.each(LIBRARY_SECTION_IDS)("uses the shared size or the %s size according to the switch", (sectionId) => {
    const preferences = { libraryIndependentGridCardSizes: false, libraryGridCardSize: 192, libraryGridCardSizes: sizes };
    expect(resolveLibraryGridCardSize(preferences, sectionId)).toBe(192);
    expect(resolveLibraryGridCardSize({ ...preferences, libraryIndependentGridCardSizes: true }, sectionId)).toBe(sizes[sectionId]);
  });
  it("maps old pixel sizes to named steps and old panel grids to two columns", () => {
    expect([80, 100, 144, 180, 256].map(readLibraryGridCardSize)).toEqual([80, 80, 128, 192, 256]);
    expect(readLibraryPanelViewDefault("grid")).toBe("two-column");
    expect(readLibraryPanelViewDefault("one-column")).toBe("one-column");
  });
  it.each([null, [], "bad", 128])("restores defaults from unsupported stored sizes %s", (stored) => {
    expect(readLibraryGridCardSizes(stored)).toEqual({ encounters: 128, backgrounds: 128, tokens: 128, audio: 128 });
  });
});
