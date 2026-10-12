import { Provider } from "react-redux";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import { CanvasSettings } from "@ui/settings/CanvasSettings";
import { CANVAS_PREFERENCES_KEY } from "@ui/canvas_preferences/canvasPreferenceStorage";
import {
  DEFAULT_ZONE_COLOR_DEFAULTS,
  INTERFACE_PREFERENCES_STORAGE_KEY,
  InterfacePreferenceProvider
} from "@ui/interface_preferences/InterfacePreferenceProvider";

describe("CanvasSettings", () => {
  afterEach(() => {
    localStorage.removeItem(CANVAS_PREFERENCES_KEY);
    localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
  });

  function renderSettings() {
    return render(
      <Provider store={store}>
        <InterfacePreferenceProvider>
          <CanvasSettings />
        </InterfacePreferenceProvider>
      </Provider>
    );
  }

  it("persists valid default zone colors and opacity", async () => {
    const user = userEvent.setup();
    renderSettings();

    const colors = within(screen.getByRole("region", { name: "Zone appearance" }));
    const zoneColor = colors.getByRole("textbox", { name: "Default zone color" });
    const borderColor = colors.getByRole("textbox", { name: "Default border color" });
    const zoneOpacity = colors.getByRole("slider", { name: "Default zone opacity" });
    const engagementColor = colors.getByRole("textbox", { name: "Default engagements color" });
    const showBorder = colors.getByRole("switch", { name: "Show border by default" });

    expect(zoneColor).toHaveValue("");
    expect(zoneColor).toHaveAttribute("placeholder", "#ffffff");
    expect(zoneOpacity).toHaveValue("0.7");
    expect(colors.getByText("70%")).toBeInTheDocument();
    expect(borderColor).toHaveAttribute("placeholder", "#ffffff");
    expect(engagementColor).toHaveAttribute("placeholder", "#ffffff");
    expect(showBorder).toBeChecked();

    await user.type(zoneColor, "#ABCDEF{Enter}");
    fireEvent.change(zoneOpacity, { target: { value: "0.6" } });
    await user.click(showBorder);
    await user.type(engagementColor, "#FED7AA{Enter}");

    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({
        zoneColorDefaults: {
          ...DEFAULT_ZONE_COLOR_DEFAULTS,
          engagement: "#fed7aa",
          zone: "#abcdef"
        },
        zoneOpacityDefault: 0.6,
        zoneShowBorderDefault: false
      });

    await user.clear(engagementColor);
    await user.type(engagementColor, "{Enter}");
    await user.type(borderColor, "#123456{Enter}");
    expect(engagementColor).toHaveAttribute("placeholder", "#123456");

    await user.clear(zoneColor);
    await user.type(zoneColor, "{Enter}");
    await user.clear(borderColor);
    await user.type(borderColor, "{Enter}");
    expect(zoneColor).toHaveAttribute("placeholder", "#ffffff");
    expect(borderColor).toHaveAttribute("placeholder", "#ffffff");
    expect(engagementColor).toHaveAttribute("placeholder", "#ffffff");

    await user.type(borderColor, "invalid{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("six-digit hex color");
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!))
      .toMatchObject({ zoneColorDefaults: { border: null } });
  });
});
