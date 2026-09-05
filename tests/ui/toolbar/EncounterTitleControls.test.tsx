import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Provider } from "react-redux";

import { undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { EncounterTitleControls } from "@ui/toolbar/EncounterTitleControls";

function renderControls(
  overrides: Partial<React.ComponentProps<typeof EncounterTitleControls>> = {}
) {
  return render(
    <Provider store={store}>
      <EncounterTitleControls
        onSave={vi.fn()}
        readOnly={false}
        saveStatus="idle"
        {...overrides}
      />
    </Provider>
  );
}

describe("EncounterTitleControls save button", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("commits a trimmed title as one undoable history action", async () => {
    const user = userEvent.setup();

    renderApp();
    await user.click(
      screen.getByRole("button", { name: "Edit encounter name Untitled Encounter" })
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

  it("uses SavePen for an unfiled encounter and omits the side status indicator", () => {
    renderControls();

    const button = screen.getByRole("button", { name: "Save encounter" });
    expect(button).toHaveAttribute(
      "title",
      "Save encounter to Library (Ctrl/Cmd+S)"
    );
    expect(button.querySelector("svg")).toHaveClass("lucide-save-pen");
    expect(screen.queryByText("Not saved")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /Persistence status/ })).not.toBeInTheDocument();
  });

  it("uses SaveCheck for an existing encounter and dulls it while saving", () => {
    const { rerender } = renderControls({ hasSavedEncounter: true, saveStatus: "saved" });
    let button = screen.getByRole("button", { name: "Save encounter" });

    expect(button.querySelector("svg")).toHaveClass("lucide-save-check");
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    rerender(
      <Provider store={store}>
        <EncounterTitleControls
          hasSavedEncounter
          onSave={vi.fn()}
          readOnly={false}
          saveStatus="saving"
        />
      </Provider>
    );
    button = screen.getByRole("button", { name: "Save encounter" });

    expect(button).toBeDisabled();
    expect(button.querySelector("svg")).toHaveClass("lucide-save-check");
    expect(button.querySelector("svg")).not.toHaveClass("lucide-loader-circle");
    expect(screen.queryByText("Saving")).not.toBeInTheDocument();
  });
});
