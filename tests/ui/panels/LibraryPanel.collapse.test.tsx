import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderApp } from "@tests/ui/renderApp";

describe("LibraryPanel", () => {
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
