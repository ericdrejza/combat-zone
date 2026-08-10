import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("Toolbar zone and background", () => {
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
      screen.getByRole("radiogroup", { name: "Zone shape options" })
    ).toBeInTheDocument();
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
    expect(screen.getByRole("menuitem", { name: "Add" })).toBeInTheDocument();
  });
});
