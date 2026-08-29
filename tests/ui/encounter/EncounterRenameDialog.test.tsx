import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import {
  redoEncounterChange,
  resetEncounterState,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { EncounterRenameDialog } from "@ui/encounter/EncounterRenameDialog";

describe("EncounterRenameDialog", () => {
  beforeEach(() => {
    store.dispatch(resetEncounterState());
  });

  it("commits one trimmed rename that undoes and redoes exactly", async () => {
    const user = userEvent.setup();
    const originalName = store.getState().encounter.present.name;
    const onClose = vi.fn();

    render(
      <Provider store={store}>
        <EncounterRenameDialog onClose={onClose} />
      </Provider>
    );

    const input = screen.getByRole("textbox", { name: "Encounter name" });
    await user.clear(input);
    await user.type(input, "  Mobile Ambush  ");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(store.getState().encounter.present.name).toBe("Mobile Ambush");
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe(
      "encounter.rename"
    );
    expect(onClose).toHaveBeenCalledOnce();

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(store.getState().encounter.present.name).toBe(originalName);

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(store.getState().encounter.present.name).toBe("Mobile Ambush");
  });

  it("does not allow an empty trimmed name", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <EncounterRenameDialog onClose={() => undefined} />
      </Provider>
    );

    const input = screen.getByRole("textbox", { name: "Encounter name" });
    await user.clear(input);
    await user.type(input, "   ");

    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
  });
});
