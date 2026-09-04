import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";

import { store } from "@store/store";
import {
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { renderApp } from "@tests/ui/renderApp";

const DefaultTestImage = globalThis.Image;

describe("Toolbar zone and background", () => {
  afterEach(() => {
    vi.stubGlobal("Image", DefaultTestImage);
  });

  class LoadedImage {
    height = 450;
    naturalHeight = 450;
    naturalWidth = 800;
    width = 800;
    private listeners = new Map<string, () => void>();

    addEventListener(type: string, listener: () => void) {
      this.listeners.set(type, listener);
    }

    set src(_value: string) {
      queueMicrotask(() => this.listeners.get("load")?.());
    }
  }

  it("opens Zone shape radios from the Zone toolbar button", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Zone" }));

    const shapeOptions = screen.getByRole("radiogroup", {
      name: "Zone shape options"
    });

    expect(
      within(shapeOptions).getByRole("radio", { name: "Rectangle zone shape" })
    ).toHaveAttribute("aria-checked", "true");
    expect(within(shapeOptions).getByText("1")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("2")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("3")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("4")).toBeInTheDocument();
    expect(
      within(shapeOptions).getByRole("radio", { name: "Hexagon zone shape" })
    ).toBeInTheDocument();

    await user.click(
      within(shapeOptions).getByRole("radio", { name: "Circle zone shape" })
    );

    expect(store.getState().interaction.zoneShapeMode).toBe("circle");
    expect(screen.getByText("Zone shape: circle")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Zone shape options" })
    ).toBeInTheDocument();
  });

  it("adds and deletes a canvas background image from the Background toolbar menu", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Background" }));

    expect(screen.getByRole("menuitem", { name: "Add" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Replace" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Delete" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Add" }));

    fireEvent.change(screen.getByLabelText("Upload background image"), {
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
        screen.getByLabelText("Canvas background image")
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Zone" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Background" }));

    expect(screen.getByRole("menuitem", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Add" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Canvas background image")
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("menuitem", { name: "Add" })).toBeInTheDocument();
  });

  it("adds a URL-backed background from the link-2 action", async () => {
    vi.stubGlobal("Image", LoadedImage);
    const user = userEvent.setup();

    renderApp();
    await user.click(screen.getByRole("button", { name: "Background" }));
    await user.click(
      screen.getByRole("menuitem", { name: "Add background from web" })
    );
    await user.type(
      screen.getByRole("textbox", { name: "Image URL" }),
      "https://maps.example/arena.png"
    );
    await user.click(screen.getByRole("button", { name: "Add image" }));

    await waitFor(() => {
      expect(store.getState().encounter.present.backgroundImage).toMatchObject({
        source: { kind: "url", url: "https://maps.example/arena.png" },
        height: 450,
        width: 800
      });
    });
    expect(store.getState().encounter.past).toHaveLength(1);
    store.dispatch(undoEncounterChange());
    expect(store.getState().encounter.present.backgroundImage).toBeNull();
    store.dispatch(redoEncounterChange());
    expect(store.getState().encounter.present.backgroundImage?.source).toEqual({
      kind: "url",
      url: "https://maps.example/arena.png"
    });
  });
});
