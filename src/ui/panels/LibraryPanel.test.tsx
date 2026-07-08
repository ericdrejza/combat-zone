import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderApp } from "../../test/ui/renderApp";

describe("LibraryPanel", () => {
  it("shows the current folder as the first panel body item", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    await user.click(screen.getByRole("button", { name: "Add to Tokens" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));

    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [
          new File(["token"], "scout-token.png", {
            type: "image/png"
          })
        ]
      }
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole("dialog", { name: "Asset Library" })).getAllByText(
          "scout-token.png"
        ).length
      ).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Select" }));

    const libraryPanel = screen.getByRole("region", { name: "Library panel" });
    const currentFolder = within(libraryPanel).getByLabelText(
      "Current library folder"
    );
    const assetButton = within(libraryPanel).getByRole("button", {
        name: "scout-token.png"
      });

    expect(currentFolder).toHaveTextContent("Tokens");
    expect(
      currentFolder.compareDocumentPosition(assetButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("applies an uploaded library background to the canvas", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    await user.click(screen.getByRole("button", { name: "Add to Backgrounds" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));

    fireEvent.change(screen.getByLabelText("Upload library image"), {
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
        within(screen.getByRole("dialog", { name: "Asset Library" })).getAllByText(
          "battle-map.png"
        ).length
      ).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Background" }));
    await user.click(screen.getByRole("button", { name: "battle-map.png" }));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Canvas background image")
      ).toBeInTheDocument();
    });
  });

  it("shows token assets when Select is active", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    await user.click(screen.getByRole("button", { name: "Add to Tokens" }));
    await user.click(screen.getByRole("menuitem", { name: "Upload new image" }));

    fireEvent.change(screen.getByLabelText("Upload library image"), {
      target: {
        files: [
          new File(["token"], "scout-token.png", {
            type: "image/png"
          })
        ]
      }
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole("dialog", { name: "Asset Library" })).getAllByText(
          "scout-token.png"
        ).length
      ).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));
    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(
      screen.getByRole("button", { name: "scout-token.png" })
    ).toBeInTheDocument();
  });
});
