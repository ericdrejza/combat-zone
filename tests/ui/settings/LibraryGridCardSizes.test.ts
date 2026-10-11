import { describe, expect, it } from "vitest";
import { LIBRARY_SECTION_IDS } from "@library/types";
import { readLibraryGridCardSizes, resolveLibraryGridCardSize } from "@ui/interface_preferences/libraryPreferences";

describe("Library grid size selection", () => {
  const sizes = { encounters: 80, backgrounds: 144, tokens: 192, audio: 256 };
  it.each(LIBRARY_SECTION_IDS)("uses the shared size or the %s size according to the switch", (sectionId) => {
    const preferences = { libraryIndependentGridCardSizes: false, libraryGridCardSize: 160, libraryGridCardSizes: sizes };
    expect(resolveLibraryGridCardSize(preferences, sectionId)).toBe(160);
    expect(resolveLibraryGridCardSize({ ...preferences, libraryIndependentGridCardSizes: true }, sectionId)).toBe(sizes[sectionId]);
  });
  it.each([null, [], "bad", 128])("restores defaults from unsupported stored sizes %s", (stored) => {
    expect(readLibraryGridCardSizes(stored)).toEqual({ encounters: 128, backgrounds: 128, tokens: 128, audio: 128 });
  });
});
