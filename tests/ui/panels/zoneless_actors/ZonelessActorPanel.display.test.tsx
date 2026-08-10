import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { CANVAS_BACKGROUND_COLOR } from "@ui/canvas/canvasConstants";
import { getReadableTextColor } from "@ui/canvas/canvasLuminance";
import {
  actor,
  mockBackgroundImageLuminance,
  seedEncounter
} from "./ZonelessActorPanel.test_support";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ZonelessActorPanel display", () => {
  it("is collapsed initially, exposes a count, and sorts actors alphabetically", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      seedEncounter([
        actor("actor-z", "Zephyr"),
        actor("actor-a", "Aegis"),
        actor("actor-m", "Mira")
      ]);
      store.dispatch(setActiveTool("actor"));
    });

    const panel = screen.getByRole("complementary", {
      name: "Zoneless actors"
    });
    expect(panel).toHaveTextContent("3");
    expect(panel).toHaveClass("bg-transparent");
    expect(panel).toHaveStyle({
      borderColor: getReadableTextColor(CANVAS_BACKGROUND_COLOR),
      color: getReadableTextColor(CANVAS_BACKGROUND_COLOR)
    });
    expect(screen.queryByRole("button", { name: "Aegis" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    const actorButtons = ["Aegis", "Mira", "Zephyr"].map((name) =>
      screen.getByRole("button", { name })
    );
    expect(
      actorButtons.map((button) => button.lastElementChild?.textContent)
    ).toEqual(["Aegis", "Mira", "Zephyr"]);
  });

  it("groups actors by Hero, Neutral, Enemy while retaining alphabetical order", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      seedEncounter([
        actor("actor-enemy", "Bandit", "enemy"),
        actor("actor-hero", "Aria", "hero"),
        actor("actor-neutral", "Boulder", "neutral")
      ]);
      store.dispatch(setActiveTool("actor"));
    });

    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    const panel = screen.getByRole("complementary", {
      name: "Zoneless actors"
    });
    expect(screen.getByRole("checkbox", { name: "Group by faction" })).toBeChecked();
    expect(
      within(panel).getAllByRole("heading").map((heading) => heading.textContent)
    ).toEqual(["Hero", "Neutral", "Enemy"]);
  });

  it("uses contrast text colors for actor names", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      seedEncounter([
        actor("actor-hero", "Aegis", "hero"),
        actor("actor-neutral", "Boulder", "neutral")
      ]);
      store.dispatch(setActiveTool("actor"));
    });
    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    expect(screen.getByText("Aegis")).toHaveStyle("color: #ffffff");
    expect(screen.getByText("Boulder")).toHaveStyle("color: #111827");
  });

  it("uses the sampled background image luminance for collapsed panel colors", async () => {
    const user = userEvent.setup();
    let backgroundPixel: [number, number, number] = [0, 0, 0];
    mockBackgroundImageLuminance(backgroundPixel);

    renderApp();
    act(() => {
      seedEncounter(
        [actor("actor-a", "Aegis")],
        [],
        {
          dataUrl: "data:image/png;base64,dark",
          height: 100,
          mediaType: "image/png",
          name: "dark.png",
          width: 100
        }
      );
      store.dispatch(setActiveTool("actor"));
    });

    const panel = screen.getByRole("complementary", {
      name: "Zoneless actors"
    });
    await waitFor(() => {
      expect(panel).toHaveStyle({ color: "#ffffff" });
    });

    backgroundPixel[0] = 255;
    backgroundPixel[1] = 255;
    backgroundPixel[2] = 255;
    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.background.replace"),
          nextEncounter: {
            ...encounter,
            backgroundImage: {
              ...encounter.backgroundImage!,
              dataUrl: "data:image/png;base64,light"
            }
          }
        })
      );
    });

    await waitFor(() => {
      expect(panel).toHaveStyle({ color: "#111827" });
    });

    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );
  });
});
