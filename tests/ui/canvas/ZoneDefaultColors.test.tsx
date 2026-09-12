import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool
} from "@tests/ui/renderApp";

describe("Zone default colors", () => {
  afterEach(() => {
    localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
  });

  it("creates zones with configured independent engagement colors", async () => {
    localStorage.setItem(
      INTERFACE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        zoneOpacityDefault: 0.35,
        zoneShowBorderDefault: false,
        zoneColorDefaults: {
          border: "#123456",
          engagement: "#fed7aa",
          zone: "#abcdef"
        }
      })
    );
    const user = userEvent.setup();
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);
    await screen.findByLabelText("Zone 1");

    const zoneId = store.getState().encounter.present.zones.allIds[0];
    expect(store.getState().encounter.present.zones.byId[zoneId]).toMatchObject({
      colorBorder: "#123456",
      colorEngagement: "#fed7aa",
      colorFill: "#abcdef",
      matchEngagementColorToBorder: false,
      opacity: 0.35,
      showBorder: false
    });
  });

  it("matches the configured border when no engagement default is set", async () => {
    localStorage.setItem(
      INTERFACE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        zoneColorDefaults: {
          border: "#123456",
          engagement: null,
          zone: "#abcdef"
        }
      })
    );
    const user = userEvent.setup();
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);
    await screen.findByLabelText("Zone 1");

    const zoneId = store.getState().encounter.present.zones.allIds[0];
    expect(store.getState().encounter.present.zones.byId[zoneId]).toMatchObject({
      colorBorder: "#123456",
      colorEngagement: "#123456",
      colorFill: "#abcdef",
      matchEngagementColorToBorder: true,
      opacity: 0.7,
      showBorder: true
    });
  });

  it("uses the first palette color when zone and border defaults are unset", async () => {
    const user = userEvent.setup();
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);
    await screen.findByLabelText("Zone 1");

    const zoneId = store.getState().encounter.present.zones.allIds[0];
    expect(store.getState().encounter.present.zones.byId[zoneId]).toMatchObject({
      colorBorder: "#ffffff",
      colorEngagement: "#ffffff",
      colorFill: "#ffffff",
      matchEngagementColorToBorder: true
    });
  });
});
