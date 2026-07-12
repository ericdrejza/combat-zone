import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderApp } from "../test/ui/renderApp";

describe("App", () => {
  it("renders the workspace frame", () => {
    renderApp();

    expect(screen.getByRole("banner", { name: "Combat Zone toolbar" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Encounter canvas" })).toBeInTheDocument();
    expect(screen.getByLabelText("left docked panels")).toBeInTheDocument();
    expect(screen.getByLabelText("right docked panels")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Bottom status, initiative, and validation area")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status panel")).toBeInTheDocument();
    expect(screen.getByText("Entity detail scaffold.")).toBeInTheDocument();
  });

  it("collapses and expands either sidebar independently", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Collapse left sidebar" }));

    expect(screen.queryByLabelText("left docked panels")).not.toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Encounter canvas" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand left sidebar" })
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Collapse right sidebar" }));

    expect(screen.queryByLabelText("right docked panels")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand right sidebar" })
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Expand left sidebar" }));
    await user.click(screen.getByRole("button", { name: "Expand right sidebar" }));

    expect(screen.getByLabelText("left docked panels")).toBeInTheDocument();
    expect(screen.getByLabelText("right docked panels")).toBeInTheDocument();
  });
});
