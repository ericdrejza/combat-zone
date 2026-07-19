import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool
} from "@tests/ui/renderApp";

describe("ZonePropertiesPanel", () => {
  it("edits zone fill, opacity, border, and name display properties", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    expect(zone).toHaveAttribute("fill", "#ffffff");
    expect(zone).toHaveAttribute("fill-opacity", "0");
    expect(screen.getByText("Zone 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Color" }));

    expect(screen.getByRole("button", { name: "Color" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(
      screen.queryByRole("button", { name: "Fill color #bfdbfe" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Color" }));
    await user.click(screen.getByRole("button", { name: "Fill color #365314" }));
    act(() => {
      fireEvent.change(screen.getByLabelText("Zone opacity"), {
        target: { value: "0" }
      });
    });
    await user.click(screen.getByRole("checkbox", { name: /Show border/ }));
    await user.click(screen.getByRole("button", { name: "Show zone name" }));
    await user.click(screen.getByRole("radio", { name: "Bottom right" }));

    expect(zone).toHaveAttribute("fill", "#365314");
    expect(zone).toHaveAttribute("fill-opacity", "0");
    expect(zone).toHaveAttribute("stroke", "transparent");
    expect(zone).toHaveAttribute("stroke-width", "0");
    expect(screen.getByText("Zone 1", { selector: "text" })).toHaveAttribute(
      "fill",
      "#111827"
    );
    expect(store.getState().encounter.present.zones.byId[
      zone.getAttribute("data-entity-id") ?? ""
    ]).toMatchObject({
      colorFill: "#365314",
      namePosition: "bottom-right",
      opacity: 0,
      showBorder: false,
      showName: true
    });
  });

  it("shows layout orientation only for split layout strategies", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    expect(await screen.findByLabelText("Zone 1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Layout orientation")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "SPLIT_FLEX" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "SPLIT_SEQUENTIAL" }));
    expect(
      screen.getByRole("radio", { name: "Left to right" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Top to bottom" }));
    expect(
      screen.getByRole("radio", { name: "Top to bottom" })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Current layout descriptor: SPLIT_SEQUENTIAL, TOP_BOTTOM, 3 sections.")
    ).toBeInTheDocument();
  });

  it("exports first selected zone properties to the rest of a multi-selection", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 40, y: 40 }, { x: 100, y: 100 });
    createRectangleZone(canvas, { x: 160, y: 40 }, { x: 220, y: 100 });
    createRectangleZone(canvas, { x: 300, y: 40 }, { x: 360, y: 100 });

    const firstZone = await screen.findByLabelText("Zone 1");
    const secondZone = await screen.findByLabelText("Zone 2");
    const thirdZone = await screen.findByLabelText("Zone 3");
    const firstZoneId = firstZone.getAttribute("data-entity-id") ?? "";
    const secondZoneId = secondZone.getAttribute("data-entity-id") ?? "";
    const thirdZoneId = thirdZone.getAttribute("data-entity-id") ?? "";

    act(() => {
      fireEvent.click(firstZone, { clientX: 60, clientY: 60 });
      fireEvent.click(secondZone, {
        clientX: 180,
        clientY: 60,
        ctrlKey: true
      });
      fireEvent.keyDown(window, { ctrlKey: true, key: "a" });
    });

    expect(store.getState().interaction.selection.selectedIds).toEqual([
      firstZoneId,
      secondZoneId,
      thirdZoneId
    ]);
    expect(
      screen.getByRole("button", { name: "Export first selected zone properties" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fill color #bfdbfe" }));
    act(() => {
      fireEvent.change(screen.getByLabelText("Zone opacity"), {
        target: { value: "0.4" }
      });
    });
    await user.click(screen.getByRole("button", { name: "Show zone name" }));
    await user.click(screen.getByRole("radio", { name: "Bottom right" }));
    await user.click(screen.getByRole("radio", { name: "SPLIT_FLEX" }));
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Top to bottom" }));
      fireEvent.change(screen.getByLabelText("Tags"), {
        target: { value: "hazard, elevated" }
      });
      fireEvent.blur(screen.getByLabelText("Tags"));
    });

    await user.click(
      screen.getByRole("button", { name: "Export first selected zone properties" })
    );

    const zones = store.getState().encounter.present.zones.byId;

    expect(zones[secondZoneId]).toMatchObject({
      colorFill: "#bfdbfe",
      layoutStrategy: "SPLIT_FLEX",
      layoutOrientation: "TOP_BOTTOM",
      namePosition: "bottom-right",
      opacity: 0.4,
      showName: true,
      tags: ["hazard", "elevated"]
    });
    expect(zones[thirdZoneId]).toMatchObject({
      colorFill: "#bfdbfe",
      layoutStrategy: "SPLIT_FLEX",
      layoutOrientation: "TOP_BOTTOM",
      namePosition: "bottom-right",
      opacity: 0.4,
      showName: true,
      tags: ["hazard", "elevated"]
    });
  });

  it("toggles the zone color paint brush from the color section", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const firstZone = await screen.findByLabelText("Zone 1");
    const firstZoneId = firstZone.getAttribute("data-entity-id");

    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));

    expect(store.getState().interaction.zonePaintBrush).toMatchObject({
      sourceZoneId: firstZoneId
    });

    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));

    expect(store.getState().interaction.zonePaintBrush).toBeNull();
  });

  it("uses the last modified zone opacity for newly created zones", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const firstZone = await screen.findByLabelText("Zone 1");

    expect(firstZone).toHaveAttribute("fill-opacity", "0");

    act(() => {
      fireEvent.change(screen.getByLabelText("Zone opacity"), {
        target: { value: "0.35" }
      });
    });

    createRectangleZone(canvas, { x: 260, y: 80 }, { x: 360, y: 160 });

    expect(await screen.findByLabelText("Zone 2")).toHaveAttribute(
      "fill-opacity",
      "0.35"
    );
  });
});
