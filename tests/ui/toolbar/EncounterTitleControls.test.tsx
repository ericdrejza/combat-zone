import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("encounter title controls", () => {
  it("commits a trimmed title as one undoable history action", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(
      screen.getByRole("button", {
        name: "Edit encounter name Untitled Encounter"
      })
    );
    const title = screen.getByRole("textbox", { name: "Encounter name" });
    await user.clear(title);
    await user.type(title, "  Ruined Keep  ");
    fireEvent.blur(title);

    await waitFor(() => {
      expect(store.getState().encounter.present.name).toBe("Ruined Keep");
    });
    expect(store.getState().encounter.past).toHaveLength(1);

    store.dispatch(undoEncounterChange());
    expect(store.getState().encounter.present.name).toBe("Untitled Encounter");
  });
});
