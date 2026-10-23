import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderApp } from "@tests/ui/renderApp";
import { store } from "@store/store";
import { setActiveTool } from "@interaction/interactionState";

describe("LibraryPanel", () => {
  it("disables expansion for unsupported tools while allowing an open panel to collapse", async () => {
    const user = userEvent.setup();
    renderApp();
    const collapse = screen.getByRole("button", { name: "Collapse Library panel" });
    expect(collapse).toBeEnabled();
    await user.click(collapse);
    const before = store.getState().encounter;

    for (const tool of ["zone", "select", "grid", "ruler", "edge", "annotation"] as const) {
      act(() => { store.dispatch(setActiveTool(tool)); });
      const expand = screen.getByRole("button", { name: "Expand Library panel" });
      expect(expand).toBeDisabled();
      await user.click(expand);
      expect(store.getState().encounter).toBe(before);
    }

    for (const tool of ["actor", "background", "audio"] as const) {
      act(() => { store.dispatch(setActiveTool(tool)); });
      expect(screen.getByRole("button", { name: "Expand Library panel" })).toBeEnabled();
    }
    await user.click(screen.getByRole("button", { name: "Expand Library panel" }));
    act(() => { store.dispatch(setActiveTool("zone")); });
    expect(screen.getByRole("button", { name: "Collapse Library panel" })).toBeEnabled();
  });

  it("reopens the Library panel from Actor only when Select auto-collapsed it", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(
      screen.getByRole("button", { name: "Expand Library panel" })
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(
      screen.getByRole("button", { name: "Collapse Library panel" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the Library panel collapsed for Actor when the user collapsed it manually", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(
      screen.getByRole("button", { name: "Collapse Library panel" })
    );
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(
      screen.getByRole("button", { name: "Expand Library panel" })
    ).toHaveAttribute("aria-expanded", "false");
  });
});
