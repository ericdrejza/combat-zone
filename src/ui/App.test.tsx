import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor } from "@entities/actor/actorMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@test/ui/renderApp";

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

  it("renames every selected actor with Enter and records one history change", async () => {
    const user = userEvent.setup();

    renderApp();
    const seeded = ["actor-a", "actor-b"].reduce(
      (encounter, actorId) =>
        createActor(encounter, {
          currentZoneId: "zoneless",
          id: actorId,
          name: actorId
        }),
      createEncounterState({ id: "rename-test", name: "Rename test" })
    );
    act(() => {
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.seed"),
          nextEncounter: seeded
        })
      );
      store.dispatch(setActiveTool("actor"));
      store.dispatch(
        selectEntity({ entityType: "actor", ids: ["actor-a", "actor-b"] })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Actor" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });
    fireEvent.keyDown(window, { key: "r" });
    const dialog = screen.getByRole("dialog", { name: "Rename actors" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "New actor name" }),
      "Guard"
    );
    fireEvent.keyDown(
      within(dialog).getByRole("textbox", { name: "New actor name" }),
      { key: "Enter" }
    );

    expect(screen.queryByRole("dialog", { name: "Rename actors" })).not.toBeInTheDocument();
    expect(store.getState().encounter.present.actors.byId["actor-a"]?.name).toBe("Guard");
    expect(store.getState().encounter.present.actors.byId["actor-b"]?.name).toBe("Guard");
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe("actor.renameMany");
  });

  it("closes actor rename on Escape without changing names", async () => {
    const user = userEvent.setup();

    renderApp();
    const seeded = createActor(
      createEncounterState({ id: "rename-escape", name: "Rename escape" }),
      { currentZoneId: "zoneless", id: "actor-a", name: "Original" }
    );
    act(() => {
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.seed"),
          nextEncounter: seeded
        })
      );
      store.dispatch(setActiveTool("actor"));
      store.dispatch(selectEntity({ entityType: "actor", ids: ["actor-a"] }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Actor" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });
    fireEvent.keyDown(window, { key: "r" });
    await user.type(screen.getByRole("textbox", { name: "New actor name" }), "Changed");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "New actor name" }), {
      key: "Escape"
    });

    expect(screen.queryByRole("dialog", { name: "Rename actors" })).not.toBeInTheDocument();
    expect(store.getState().encounter.present.actors.byId["actor-a"]?.name).toBe("Original");
  });
});
