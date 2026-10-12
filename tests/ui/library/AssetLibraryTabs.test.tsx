import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssetLibraryTabs } from "@ui/library/AssetLibraryTabs";

describe("Asset Library tabs", () => {
  it("keeps Encounters first and alphabetizes asset tabs including Characters", () => {
    const onSelect = vi.fn();
    render(<AssetLibraryTabs activeTabId="encounters" encounterOnly={false} onSelect={onSelect} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Encounters", "Audio", "Backgrounds", "Characters", "Tokens"
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "Characters" }));
    expect(onSelect).toHaveBeenCalledWith("characters");
  });
  it("retains restricted tab sets for pickers and encounter destinations", () => {
    const { rerender } = render(<AssetLibraryTabs activeTabId="tokens" lockedSectionId="tokens" encounterOnly={false} onSelect={() => undefined} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Tokens"]);
    rerender(<AssetLibraryTabs activeTabId="encounters" encounterOnly onSelect={() => undefined} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Encounters"]);
  });
});
