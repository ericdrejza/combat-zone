import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { uploadImage } from "@library/librarySlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("Characters Library scaffold", () => {
  it("uses the shared explorer and views while staying empty and preserving existing data", () => {
    renderApp();
    act(() => store.dispatch(uploadImage({
      sectionId: "tokens",
      parentId: "tokens-root",
      asset: {
        name: "Scout",
        mediaType: "image/png",
        source: { kind: "embedded", dataUrl: "data:image/png;base64,scout" }
      }
    })));
    const encounterBefore = store.getState().encounter;
    const libraryBefore = store.getState().library;
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    const dialog = screen.getByRole("dialog", { name: "Asset Library" });
    fireEvent.click(within(dialog).getByRole("tab", { name: "Characters" }));
    expect(within(dialog).getByRole("tab", { name: "Characters" })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByRole("heading", { name: "Characters" })).toBeInTheDocument();
    expect(within(dialog).getByRole("searchbox", { name: "Search asset library" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add to Characters" })).toBeDisabled();
    expect(within(dialog).getByRole("group", { name: "Current directory contents" })).toBeEmptyDOMElement();
    expect(within(dialog).queryByRole("button", { name: "Create Actor" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch library contents to list view" }));
    expect(within(dialog).getByRole("button", { name: "Switch library contents to grid view" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Tokens" }));
    expect(within(dialog).getByRole("button", { name: "Scout" })).toBeInTheDocument();
    expect(store.getState().encounter).toBe(encounterBefore);
    expect(store.getState().library).toBe(libraryBefore);
  });
});
