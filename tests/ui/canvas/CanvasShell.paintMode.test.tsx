import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool
} from "@tests/ui/renderApp";

describe("CanvasShell paint mode", () => {
  it("paints live zone color properties onto another zone without changing selection", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);
    createRectangleZone(canvas, { x: 260, y: 80 }, { x: 360, y: 160 });

    const firstZone = await screen.findByLabelText("Zone 1");
    const secondZone = await screen.findByLabelText("Zone 2");
    const firstZoneId = firstZone.getAttribute("data-entity-id");

    fireEvent.click(firstZone, { clientX: 120, clientY: 120 });
    await user.click(screen.getByRole("button", { name: "Fill color #bfdbfe" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "0.25" }
    });
    await user.click(screen.getByRole("tab", { name: "Border" }));
    await user.click(screen.getByRole("switch", { name: /Show border/ }));
    await user.click(screen.getByRole("tab", { name: "Engagements" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Match border color" })
    );
    await user.click(
      screen.getByRole("button", { name: "Engagements color #fed7aa" })
    );
    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));

    expect(store.getState().interaction.zonePaintBrush).toMatchObject({
      sourceZoneId: firstZoneId
    });

    await user.click(screen.getByRole("tab", { name: "Fill" }));
    await user.click(screen.getByRole("button", { name: "Fill color #bbf7d0" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "0.4" }
    });

    fireEvent.click(canvas, { clientX: 460, clientY: 300 });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [firstZoneId]
    });
    expect(screen.getByDisplayValue("Zone 1")).toBeInTheDocument();
    expect(store.getState().interaction.zonePaintBrush).not.toBeNull();

    fireEvent.click(secondZone, { clientX: 300, clientY: 120 });

    expect(secondZone).toHaveAttribute("fill", "#bbf7d0");
    expect(secondZone).toHaveAttribute("fill-opacity", "0.4");
    expect(secondZone).toHaveAttribute("stroke", "transparent");
    expect(
      store.getState().encounter.present.zones.byId[
        secondZone.getAttribute("data-entity-id") ?? ""
      ]
    ).toMatchObject({
      colorEngagement: "#fed7aa",
      matchEngagementColorToBorder: false
    });
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [firstZoneId]
    });
    expect(store.getState().interaction.zonePaintBrush).not.toBeNull();
  });

  it("exits paint mode by right click, Escape, paint button toggle, and other tools", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const firstZone = await screen.findByLabelText("Zone 1");
    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));
    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));

    expect(store.getState().interaction.zonePaintBrush).toBeNull();

    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));
    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(store.getState().interaction.zonePaintBrush).toBeNull();

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.click(firstZone, { clientX: 120, clientY: 120 });
    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));
    fireEvent.contextMenu(canvas, { clientX: 320, clientY: 120 });

    expect(store.getState().interaction.zonePaintBrush).toBeNull();

    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(store.getState().interaction.zonePaintBrush).toBeNull();
  });
});
