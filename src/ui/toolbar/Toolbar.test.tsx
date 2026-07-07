import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "../../store/store";
import { renderApp } from "../../test/ui/renderApp";

describe("Toolbar", () => {
  it("renders toolbar tools in the expected order with requested separators", () => {
    renderApp();
    const tools = screen.getByRole("navigation", { name: "Tools" });

    expect(
      within(tools)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Background", "Zone", "Edge", "Annotation", "Actor", "Select"]);
    expect(screen.getAllByRole("button", { name: "Background" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Engagement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(tools).getAllByRole("separator")).toHaveLength(2);
  });

  it("activates toolbar tools from button clicks and keyboard shortcuts", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Zone" }));

    expect(screen.getByRole("button", { name: "Zone" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.keyDown(window, { key: "a" });

    expect(screen.getByRole("button", { name: "Actor" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("opens Zone shape radios from the Zone toolbar button", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Zone" }));

    const shapeOptions = screen.getByRole("radiogroup", {
      name: "Zone shape options"
    });

    expect(
      within(shapeOptions).getByRole("radio", { name: "Rectangle zone shape" })
    ).toHaveAttribute("aria-checked", "true");
    expect(within(shapeOptions).getByText("1")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("2")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("3")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("4")).toBeInTheDocument();
    expect(
      within(shapeOptions).getByRole("radio", { name: "Hexagon zone shape" })
    ).toBeInTheDocument();

    await user.click(
      within(shapeOptions).getByRole("radio", { name: "Circle zone shape" })
    );

    expect(store.getState().interaction.zoneShapeMode).toBe("circle");
    expect(screen.getByText("Zone shape: circle")).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Zone shape options" })
    ).not.toBeInTheDocument();
  });

  it("adds and deletes a canvas background image from the Background toolbar menu", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Background" }));

    expect(screen.getByRole("menuitem", { name: "Add" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Replace" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Delete" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Add" }));

    fireEvent.change(screen.getByLabelText("Upload background image"), {
      target: {
        files: [
          new File(["background"], "battle-map.png", {
            type: "image/png"
          })
        ]
      }
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText("Canvas background image")
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Zone" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Background" }));

    expect(screen.getByRole("menuitem", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Add" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Canvas background image")
      ).not.toBeInTheDocument();
    });
  });
});
