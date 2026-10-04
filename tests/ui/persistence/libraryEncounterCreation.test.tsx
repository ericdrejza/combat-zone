import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

function requestNewEncounter() {
  renderApp();
  const before = store.getState().encounter.present;
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  const library = screen.getByRole("dialog", { name: "Asset Library" });
  fireEvent.click(within(library).getByRole("button", { name: "Add to Encounters" }));
  fireEvent.click(within(library).getByRole("menuitem", { name: "Create encounter" }));
  return before;
}

describe("Library encounter creation", () => {
  it("closes the Library before showing the save-draft dialog and preserves the encounter on Cancel", () => {
    const before = requestNewEncounter();
    expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
    const prompt = screen.getByRole("dialog", { name: "Save encounter draft" });
    expect(within(prompt).getByRole("heading", { name: "Save this encounter?" })).toBeInTheDocument();
    expect(store.getState().encounter.present).toBe(before);
    fireEvent.click(within(prompt).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Save encounter draft" })).not.toBeInTheDocument();
    expect(store.getState().encounter.present).toBe(before);
  });

  it("opens the Library save-destination picker when Save is chosen", () => {
    const before = requestNewEncounter();
    const prompt = screen.getByRole("dialog", { name: "Save encounter draft" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog", { name: "Save encounter draft" })).not.toBeInTheDocument();
    const library = screen.getByRole("dialog", { name: "Asset Library" });
    expect(within(library).getByRole("button", { name: "Save here" })).toBeInTheDocument();
    expect(store.getState().encounter.present).toBe(before);
  });
});
