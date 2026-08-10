import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";

import { setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { actor, seedEncounter } from "./ZonelessActorPanel.test_support";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ZonelessActorPanel resize", () => {
  it("resizes the expanded panel and exposes a reset control", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      seedEncounter([actor("actor-a", "Aegis")]);
      store.dispatch(setActiveTool("actor"));
    });
    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    const panel = screen.getByRole("complementary", {
      name: "Zoneless actors"
    });
    const rightResizeHandle = screen.getByRole("button", {
      name: "Resize zoneless actors panel right edge"
    });
    fireEvent.mouseDown(rightResizeHandle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 80, clientY: 0 });
    fireEvent.mouseUp(window);

    const leftResizeHandle = screen.getByRole("button", {
      name: "Resize zoneless actors panel left edge"
    });
    fireEvent.mouseDown(leftResizeHandle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: -24, clientY: 0 });
    fireEvent.mouseUp(window);

    const topResizeHandle = screen.getByRole("button", {
      name: "Resize zoneless actors panel top edge"
    });
    fireEvent.mouseDown(topResizeHandle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 0, clientY: -40 });
    fireEvent.mouseUp(window);

    expect(
      screen.getByRole("button", { name: "Reset zoneless actors panel size" })
    ).toBeInTheDocument();
    expect(panel).toHaveStyle({ height: "280px", width: "808px" });

    await user.click(
      screen.getByRole("button", { name: "Reset zoneless actors panel size" })
    );
    expect(
      screen.queryByRole("button", { name: "Reset zoneless actors panel size" })
    ).not.toBeInTheDocument();
    expect(panel).toHaveStyle({ height: "240px", width: "704px" });
  });
});
