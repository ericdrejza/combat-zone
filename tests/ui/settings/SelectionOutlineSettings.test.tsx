import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY,
  useInterfacePreferences
} from "@ui/interface_preferences/InterfacePreferenceProvider";
import {
  LOCAL_PREFERENCES_RESET_EVENT, MotionPreferenceProvider
} from "@ui/motion_preferences/MotionPreferenceProvider";
import { useSelectionOutlineMode } from "@ui/canvas/useSelectionOutlineMode";
import { SelectionOutlineSettings } from "@ui/settings/SelectionOutlineSettings";

function EffectiveModes() {
  const actor = useSelectionOutlineMode("actor");
  const zone = useSelectionOutlineMode("zone");
  const { enableAssetAnimation, setEnableAssetAnimation } = useInterfacePreferences();
  return <>
    <output aria-label="Effective Actor outline mode">{actor}</output>
    <output aria-label="Effective Zone outline mode">{zone}</output>
    <button onClick={() => setEnableAssetAnimation(!enableAssetAnimation)}>Toggle animations</button>
  </>;
}

function setup() {
  return render(<MotionPreferenceProvider><InterfacePreferenceProvider>
    <SelectionOutlineSettings /><EffectiveModes />
  </InterfacePreferenceProvider></MotionPreferenceProvider>);
}
const mode = (entity: string) => screen.getByRole("combobox", { name: `Selected ${entity} outline` });
const width = (entity: string) => screen.getByRole("slider", { name: `${entity} outline thickness` });
const saved = () => JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!);
const change = (control: HTMLElement, value: string) => fireEvent.change(control, { target: { value } });

afterEach(() => {
  localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("preserves defaults and saves Actor and Zone choices independently across reload", () => {
  const view = setup();
  expect(mode("Actor")).toHaveValue("static");
  expect(mode("Zone")).toHaveValue("static");
  expect(width("Actor")).toHaveValue("2");
  expect(width("Zone")).toHaveValue("3");
  change(mode("Actor"), "pulse_limited");
  change(width("Actor"), "8");
  expect(mode("Zone")).toHaveValue("static");
  expect(width("Zone")).toHaveValue("3");
  change(mode("Zone"), "pulse");
  change(width("Zone"), "1");
  expect(saved()).toMatchObject({ actorSelectionOutline: "pulse_limited", actorSelectionOutlineWidth: 8,
    zoneSelectionOutline: "pulse", zoneSelectionOutlineWidth: 1 });
  view.unmount();
  setup();
  expect(mode("Actor")).toHaveValue("pulse_limited");
  expect(mode("Zone")).toHaveValue("pulse");
  expect(width("Actor")).toHaveValue("8");
  expect(width("Zone")).toHaveValue("1");
});

it("synchronizes another tab's choices and restores all four defaults on reset", () => {
  setup();
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
    actorSelectionOutline: "pulse", zoneSelectionOutline: "pulse_limited",
    actorSelectionOutlineWidth: 5, zoneSelectionOutlineWidth: 6
  }));
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: INTERFACE_PREFERENCES_STORAGE_KEY })));
  expect(mode("Actor")).toHaveValue("pulse");
  expect(mode("Zone")).toHaveValue("pulse_limited");
  expect(width("Actor")).toHaveValue("5");
  expect(width("Zone")).toHaveValue("6");
  act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
  expect(mode("Actor")).toHaveValue("static");
  expect(mode("Zone")).toHaveValue("static");
  expect(width("Actor")).toHaveValue("2");
  expect(width("Zone")).toHaveValue("3");
});

it.each([null, {}, { actorSelectionOutline: "unknown", zoneSelectionOutline: "unknown",
  actorSelectionOutlineWidth: 0, zoneSelectionOutlineWidth: 9 },
{ actorSelectionOutlineWidth: 2.5, zoneSelectionOutlineWidth: "4" }])(
  "uses existing defaults for legacy or unsupported stored preferences: %j", stored => {
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify(stored));
    setup();
    expect(mode("Actor")).toHaveValue("static");
    expect(mode("Zone")).toHaveValue("static");
    expect(width("Actor")).toHaveValue("2");
    expect(width("Zone")).toHaveValue("3");
  });

it("renders static modes while animations are disabled without replacing saved choices", () => {
  setup();
  change(mode("Actor"), "pulse_limited");
  change(mode("Zone"), "pulse");
  fireEvent.click(screen.getByRole("button", { name: "Toggle animations" }));
  expect(screen.getByLabelText("Effective Actor outline mode")).toHaveTextContent("static");
  expect(screen.getByLabelText("Effective Zone outline mode")).toHaveTextContent("static");
  expect(saved()).toMatchObject({ actorSelectionOutline: "pulse_limited", zoneSelectionOutline: "pulse" });
  fireEvent.click(screen.getByRole("button", { name: "Toggle animations" }));
  expect(screen.getByLabelText("Effective Actor outline mode")).toHaveTextContent("pulse_limited");
  expect(screen.getByLabelText("Effective Zone outline mode")).toHaveTextContent("pulse");
});

it("honors reduced motion while keeping both requested modes available in settings", () => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true,
    addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  setup();
  change(mode("Actor"), "pulse");
  change(mode("Zone"), "pulse_limited");
  expect(screen.getByLabelText("Effective Actor outline mode")).toHaveTextContent("static");
  expect(screen.getByLabelText("Effective Zone outline mode")).toHaveTextContent("static");
  expect(mode("Actor")).toHaveValue("pulse");
  expect(mode("Zone")).toHaveValue("pulse_limited");
});

it("keeps the settings usable for the session when storage writes fail", () => {
  setup();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  change(mode("Actor"), "pulse");
  change(width("Zone"), "7");
  expect(mode("Actor")).toHaveValue("pulse");
  expect(width("Zone")).toHaveValue("7");
});
