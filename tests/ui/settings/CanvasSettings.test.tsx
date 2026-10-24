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

  it('persists continuous zone and ruler opacity values without rounding to slider increments', () => {
    const view = renderSettings();
    fireEvent.change(screen.getByRole('slider', { name: 'Default zone opacity' }), { target: { value: '0.3574' } });
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ zoneOpacityDefault: 0.3574 });
    const ruler = screen.getByRole('slider', { name: 'Ruler opacity' });
    ruler.getBoundingClientRect = () => ({ left: 0, width: 116 } as DOMRect);
    fireEvent.pointerDown(ruler, { button: 0, pointerId: 2, clientX: 45.74 });
    fireEvent.pointerUp(ruler, { button: 0, pointerId: 2, clientX: 45.74 });
    expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!)).toMatchObject({ rulerOpacity: 0.3774 });
    view.unmount(); renderSettings();
    expect(screen.getByRole('slider', { name: 'Default zone opacity' })).toHaveValue('0.3574');
    expect(screen.getByRole('slider', { name: 'Ruler opacity' })).toHaveValue('0.3774');
  });

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
  it('persists and resets the default player aspect ratio without changing encounter history', () => {
    const before = store.getState().encounter;
    const view = renderSettings();
    fireEvent.change(screen.getByRole('combobox', { name: 'Default player aspect ratio' }), { target: { value: '4:3' } });
    expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!)).toMatchObject({ playerAspectRatio: { width: 4, height: 3 } });
    view.unmount(); renderSettings();
    expect(screen.getByRole('combobox', { name: 'Default player aspect ratio' })).toHaveValue('4:3');
    fireEvent.click(screen.getByRole('button', { name: 'Reset Canvas to defaults' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset to defaults' }));
    expect(screen.getByRole('combobox', { name: 'Default player aspect ratio' })).toHaveValue('16:9');
    expect(store.getState().encounter).toBe(before);
  });
});

describe('ruler appearance', () => {
  it('offers both ruler feels and persists the selected manipulation preference', () => {
    render(<Provider store={store}><CanvasSettings /></Provider>);
    const feel = screen.getByRole('combobox', { name: 'Ruler feel' });
    expect(feel).toHaveValue('rigid');
    fireEvent.change(feel, { target: { value: 'flexible' } });
    expect(feel).toHaveValue('flexible');
    expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!)).toMatchObject({ rulerFeel: 'flexible' });
    fireEvent.change(feel, { target: { value: 'rigid' } });
    expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!)).toMatchObject({ rulerFeel: 'rigid' });
  });
  afterEach(() => localStorage.removeItem(CANVAS_PREFERENCES_KEY));
  it('accepts hex alpha, retains valid settings after invalid input, and persists picker/opacity changes', () => {
    render(<Provider store={store}><CanvasSettings /></Provider>);
    const hex = screen.getByRole('textbox', { name: 'Ruler color hex color' });
    fireEvent.change(hex, { target: { value: '#12345680' } }); fireEvent.blur(hex);
    expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!)).toMatchObject({ rulerColor: '#123456', rulerOpacity: 128 / 255 });
    fireEvent.change(hex, { target: { value: '#nope' } }); fireEvent.blur(hex);
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!)).toMatchObject({ rulerColor: '#123456' });
    fireEvent.change(hex, { target: { value: '#abcdef' } }); fireEvent.blur(hex);
    fireEvent.change(screen.getByRole('slider', { name: 'Ruler opacity' }), { target: { value: '0.4' } });
    expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!)).toMatchObject({ rulerColor: '#abcdef', rulerOpacity: 0.4 });
  });
});
