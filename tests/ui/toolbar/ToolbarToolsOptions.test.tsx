import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("Toolbar tools and options", () => {
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

  it("renders distinct token size icons for actor sizes", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Actor" }));

    const sizeButtons = [
      screen.getByRole("button", { name: "Small actor size" }),
      screen.getByRole("button", { name: "Medium actor size" }),
      screen.getByRole("button", { name: "Large actor size" }),
      screen.getByRole("button", { name: "X-large actor size" })
    ];

    expect(
      sizeButtons.map(
        (button) => button.querySelectorAll("svg rect").length
      )
    ).toEqual([1, 1, 4, 9]);
    expect(
      sizeButtons.map(
        (button) => button.querySelector("svg rect")?.getAttribute("width")
      )
    ).toEqual(["8", "12", "5", "4"]);
  });

  it("separates actor option groups and gives option buttons concise tooltips", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(screen.getByRole("group", { name: "Actor faction" })).toHaveClass(
      "rounded-full"
    );
    expect(screen.getByRole("group", { name: "Actor size" })).toHaveClass(
      "rounded-full"
    );
    expect(screen.getByRole("group", { name: "Actor shape" })).toHaveClass(
      "rounded-full"
    );
    expect(screen.getByRole("group", { name: "Actor paint" })).toHaveClass(
      "rounded-full"
    );
    expect(screen.getByRole("button", { name: "Hero faction" })).toHaveAttribute(
      "title",
      "Hero"
    );
    expect(
      screen.getByRole("button", { name: "Small actor size" })
    ).toHaveAttribute("title", "Small");
    expect(
      screen.getByRole("button", { name: "Rectangle actor shape" })
    ).toHaveAttribute("title", "Rectangle");
    expect(screen.getByRole("button", { name: "Paint actors" })).toHaveAttribute(
      "title",
      "Paint"
    );
  });

  it("toggles actor paint mode from the actor toolbar", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Actor" }));
    await user.click(screen.getByRole("button", { name: "Paint actors" }));

    expect(store.getState().interaction.actorPaintBrush).toBe(true);
    expect(screen.getByRole("button", { name: "Paint actors" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Paint actors" }));

    expect(store.getState().interaction.actorPaintBrush).toBe(false);
  });
});
