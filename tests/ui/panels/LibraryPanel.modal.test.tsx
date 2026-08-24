import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { uploadImage } from "@library/librarySlice";
import {
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("LibraryPanel", () => {
  it("hands a double-clicked token from the modal to the focused Actor library panel", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      store.dispatch(
        uploadImage({
          asset: {
            dataUrl: "data:image/png;base64,scout",
            mediaType: "image/png",
            name: "Scout"
          },
          parentId: "tokens-root",
          sectionId: "tokens"
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Tokens" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Scout" }));

    expect(
      screen.queryByRole("dialog", { name: "Asset Library" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actor" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const panel = screen.getByRole("region", { name: "Library panel" });
    expect(
      within(panel).getByLabelText("Current library folder")
    ).toHaveTextContent("Tokens");
    expect(within(panel).getByRole("button", { name: "Scout" })).toHaveFocus();
  });

  it("applies a background immediately when an image is double-clicked in the modal", async () => {
    const user = userEvent.setup();
    const backgroundAction = uploadImage({
      asset: {
        dataUrl: "data:image/png;base64,battle-map",
        height: 640,
        mediaType: "image/png",
        name: "Battle Map",
        width: 960
      },
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    });

    renderApp();
    act(() => {
      store.dispatch(backgroundAction);
    });

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(screen.getByRole("tab", { name: "Backgrounds" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Battle Map" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Canvas background image")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("dialog", { name: "Asset Library" })
    ).not.toBeInTheDocument();
    expect(store.getState().encounter.present.backgroundImage?.name).toBe("Battle Map");
    expect(
      store.getState().encounter.present.backgroundImage?.libraryNodeId
    ).toBe(backgroundAction.payload.id);
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe("background.add");
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.backgroundImage).toBeNull();
    act(() => store.dispatch(redoEncounterChange()));
    expect(
      store.getState().encounter.present.backgroundImage?.libraryNodeId
    ).toBe(backgroundAction.payload.id);
  });
});
