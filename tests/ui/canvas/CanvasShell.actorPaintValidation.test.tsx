import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { selectEntity, setActiveTool } from "@interaction/interactionState";
import {
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { actor, seedEncounter, zone } from "./CanvasShell.actorSelection.test-support";

describe("CanvasShell actor paint and validation", () => {
  it("paints selected actors with active actor tool settings and preserves undo", async () => {
    const user = userEvent.setup();

    renderApp();

    act(() => {
      seedEncounter([
        {
          ...actor("actor-1"),
          layoutGroup: "enemy",
          shape: "rectangle",
          size: "large"
        },
        {
          ...actor("actor-2"),
          layoutGroup: "neutral",
          shape: "rectangle",
          size: "xLarge"
        }
      ]);
      store.dispatch(setActiveTool("actor"));
      store.dispatch(
        selectEntity({
          entityType: "actor",
          ids: ["actor-1", "actor-2"]
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "Paint actors" }));

    await waitFor(() => {
      const actors = store.getState().encounter.present.actors.byId;

      expect(actors["actor-1"]).toMatchObject({
        layoutGroup: "hero",
        shape: "circle",
        size: "medium"
      });
      expect(actors["actor-2"]).toMatchObject({
        layoutGroup: "hero",
        shape: "circle",
        size: "medium"
      });
    });

    act(() => {
      store.dispatch(undoEncounterChange());
    });

    expect(store.getState().encounter.present.actors.byId["actor-1"]).toMatchObject({
      layoutGroup: "enemy",
      shape: "rectangle",
      size: "large"
    });

    act(() => {
      store.dispatch(redoEncounterChange());
    });

    expect(store.getState().encounter.present.actors.byId["actor-2"]).toMatchObject({
      layoutGroup: "hero",
      shape: "circle",
      size: "medium"
    });

    await user.click(screen.getByRole("button", { name: "Neutral faction" }));
    await user.click(screen.getByRole("button", { name: "Small actor size" }));
    await user.click(screen.getByRole("button", { name: "Rectangle actor shape" }));

    await waitFor(() => {
      const actors = store.getState().encounter.present.actors.byId;

      expect(actors["actor-1"]).toMatchObject({
        layoutGroup: "neutral",
        shape: "rectangle",
        size: "small"
      });
      expect(actors["actor-2"]).toMatchObject({
        layoutGroup: "neutral",
        shape: "rectangle",
        size: "small"
      });
    });
  });

  it("asks before resizing a zone for an assisted actor resize", async () => {
    const user = userEvent.setup();

    renderApp();

    act(() => {
      seedEncounter(
        [actor("actor-1", "zone-1")],
        [zone("zone-1", 100, 100, 100, 100)],
        "ASSISTED"
      );
      store.dispatch(setActiveTool("actor"));
      store.dispatch(
        selectEntity({
          entityType: "actor",
          ids: ["actor-1"]
        })
      );
    });

    await user.selectOptions(screen.getByRole("combobox", { name: "Size" }), "xLarge");

    expect(screen.getByRole("dialog", { name: "Resize zone approval" })).toBeInTheDocument();
    expect(store.getState().encounter.present.actors.byId["actor-1"]?.size).toBe(
      "medium"
    );

    await user.click(screen.getByRole("button", { name: "Resize" }));

    expect(store.getState().encounter.present.actors.byId["actor-1"]?.size).toBe(
      "xLarge"
    );
    expect(
      store.getState().encounter.present.zones.byId["zone-1"]?.polygon
    ).not.toEqual(zone("zone-1", 100, 100, 100, 100).polygon);
  });
});
