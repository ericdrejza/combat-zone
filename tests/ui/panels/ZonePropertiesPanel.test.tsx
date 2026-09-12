import { act, fireEvent, screen, waitFor } from "@testing-library/react";
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
  it("edits tabbed zone colors and shows controls only on their relevant tabs", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    expect(zone).toHaveAttribute("fill", "#ffffff");
    expect(zone).toHaveAttribute("fill-opacity", "0.7");
    expect(screen.getByText("Zone 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Name" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enable automatic zone resizing" })
    ).toHaveAttribute("aria-pressed", "false");
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
    expect(screen.getByRole("tab", { name: "Fill" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("Zone opacity")).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Show border" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fill color #365314" }));
    act(() => {
      fireEvent.change(screen.getByLabelText("Zone opacity"), {
        target: { value: "0" }
      });
    });
    await user.click(screen.getByRole("tab", { name: "Border" }));
    expect(screen.queryByLabelText("Zone opacity")).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Show border" }));
    const engagementsTab = screen.getByRole("tab", { name: "Engagements" });
    expect(engagementsTab.querySelector(".lucide-swords")).toBeInTheDocument();
    await user.click(engagementsTab);
    expect(
      screen.queryByRole("switch", { name: "Show border" })
    ).not.toBeInTheDocument();
    const matchBorder = screen.getByRole("checkbox", {
      name: "Match border color"
    });
    expect(matchBorder).toBeChecked();
    expect(screen.getByRole("group", { name: "Engagements color palette" }))
      .toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Engagements color #bfdbfe" })
    ).toBeDisabled();
    await user.click(matchBorder);
    await user.click(
      screen.getByRole("button", { name: "Engagements color #bfdbfe" })
    );
    await user.click(screen.getByRole("button", { name: "Show zone name" }));
    await user.click(
      screen.getByRole("button", { name: "Enable automatic zone resizing" })
    );
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
      colorEngagement: "#bfdbfe",
      colorFill: "#365314",
      matchEngagementColorToBorder: false,
      namePosition: "bottom-right",
      opacity: 0,
      showBorder: false,
      showName: true,
      autoResize: true
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
    expect(
      screen.queryByRole("button", { name: "Show section dividers" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "SPLIT_FLEX" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "SPLIT_SEQUENTIAL" }));
    expect(
      screen.getByRole("radio", { name: "Left to right" })
    ).toBeInTheDocument();
    const dividerToggle = screen.getByRole("button", {
      name: "Show section dividers"
    });
    expect(dividerToggle).toHaveAttribute("aria-pressed", "false");
    await user.click(dividerToggle);
    expect(
      screen.getByRole("button", { name: "Hide section dividers" })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("radio", { name: "Top to bottom" }));
    expect(
      screen.getByRole("radio", { name: "Top to bottom" })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Current layout descriptor: SPLIT_SEQUENTIAL, TOP_BOTTOM, 3 sections.")
    ).toBeInTheDocument();
    expect(
      store.getState().encounter.present.zones.byId[
        store.getState().interaction.selection.selectedIds[0]
      ]?.showSectionDividers
    ).toBe(true);

    await user.click(screen.getByRole("radio", { name: "FLEX" }));
    expect(
      screen.queryByRole("button", { name: "Hide section dividers" })
    ).not.toBeInTheDocument();
  });

  it("allows the zone name to be cleared with Enter", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);
    await screen.findByLabelText("Zone 1");

    const nameInput = screen.getByRole("textbox", { name: "Zone name" });
    await user.clear(nameInput);
    await user.type(nameInput, "{Enter}");

    const selectedZoneId = store.getState().interaction.selection.selectedIds[0];
    expect(
      store.getState().encounter.present.zones.byId[selectedZoneId]?.name
    ).toBe("");
  });

  it("previews an opacity drag without committing every pointer step", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);
    const zone = await screen.findByLabelText("Zone 1");
    const opacity = screen.getByRole("slider", { name: "Zone opacity" });
    const historyLength = store.getState().encounter.past.length;

    fireEvent.pointerDown(opacity);
    fireEvent.change(opacity, { target: { value: "0.1" } });
    fireEvent.change(opacity, { target: { value: "0.2" } });
    fireEvent.change(opacity, { target: { value: "0.35" } });

    expect(opacity).toHaveValue("0.35");
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(store.getState().encounter.past).toHaveLength(historyLength);
    await waitFor(() => {
      expect(store.getState().interaction.zoneOpacityPreview).toMatchObject({
        opacity: 0.35,
        zoneId: zone.getAttribute("data-entity-id")
      });
      expect(zone).toHaveAttribute("fill-opacity", "0.35");
    });

    fireEvent.pointerUp(opacity);

    await waitFor(() => {
      expect(store.getState().encounter.past).toHaveLength(historyLength + 1);
      expect(
        store.getState().encounter.present.zones.byId[
          zone.getAttribute("data-entity-id") ?? ""
        ]?.opacity
      ).toBe(0.35);
      expect(store.getState().interaction.zoneOpacityPreview).toBeNull();
    });
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

  it("keeps the configured default after another zone opacity is modified", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const firstZone = await screen.findByLabelText("Zone 1");

    expect(firstZone).toHaveAttribute("fill-opacity", "0.7");

    act(() => {
      fireEvent.change(screen.getByLabelText("Zone opacity"), {
        target: { value: "0.35" }
      });
    });

    createRectangleZone(canvas, { x: 260, y: 80 }, { x: 360, y: 160 });

    expect(await screen.findByLabelText("Zone 2")).toHaveAttribute(
      "fill-opacity",
      "0.7"
    );
  });
});
