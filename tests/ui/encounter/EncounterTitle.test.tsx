import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import {
  redoEncounterChange,
  resetEncounterState,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { EncounterTitle } from "@ui/encounter/EncounterTitle";

describe("EncounterTitle", () => {
  beforeEach(() => {
    store.dispatch(resetEncounterState());
  });

  function renderTitle() {
    const name = store.getState().encounter.present.name;

    render(
      <Provider store={store}>
        <EncounterTitle name={name} />
      </Provider>
    );
  }

  it("selects the full name and commits one trimmed history action inline", async () => {
    const user = userEvent.setup();
    const originalName = store.getState().encounter.present.name;
    renderTitle();

    await user.click(
      screen.getByRole("button", { name: `Edit encounter name ${originalName}` })
    );

    const input = screen.getByRole("textbox", { name: "Encounter name" });
    expect(input).toHaveFocus();
    expect(input).toHaveValue(originalName);
    expect(input).toHaveSelection(originalName);

    await user.clear(input);
    await user.type(input, "  Mobile Ambush  ");
    await user.keyboard("{Enter}");

    expect(store.getState().encounter.present.name).toBe("Mobile Ambush");
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe(
      "encounter.rename"
    );

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(store.getState().encounter.present.name).toBe(originalName);

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(store.getState().encounter.present.name).toBe("Mobile Ambush");
  });

  it("closes without changing the encounter when Escape cancels or the name is empty", async () => {
    const user = userEvent.setup();
    const originalName = store.getState().encounter.present.name;
    renderTitle();

    await user.click(
      screen.getByRole("button", { name: `Edit encounter name ${originalName}` })
    );
    const input = screen.getByRole("textbox", { name: "Encounter name" });
    await user.clear(input);
    await user.type(input, "Temporary");
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("textbox", { name: "Encounter name" })
    ).not.toBeInTheDocument();
    expect(store.getState().encounter.present.name).toBe(originalName);

    await user.click(
      screen.getByRole("button", { name: `Edit encounter name ${originalName}` })
    );
    await user.clear(screen.getByRole("textbox", { name: "Encounter name" }));
    await user.keyboard("{Enter}");

    expect(store.getState().encounter.present.name).toBe(originalName);
  });
});
