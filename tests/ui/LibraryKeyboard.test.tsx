import { act, fireEvent, screen, within } from "@testing-library/react";
import { setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import { renderApp } from "./renderApp";

describe("Library keyboard routing", () => {
  it.each([["actor", "Tokens"], ["background", "Backgrounds"], ["audio", "Audio"], ["select", "Encounters"]] as const)("opens %s tool's Library section with L", async (tool, section) => {
    renderApp(); act(() => store.dispatch(setActiveTool(tool)));
    fireEvent.keyDown(window, { key: "l" });
    const dialog = await screen.findByRole("dialog", { name: "Asset Library" });
    expect(within(dialog).getByRole("tab", { name: section })).toHaveAttribute("aria-selected", "true");
  });
});
