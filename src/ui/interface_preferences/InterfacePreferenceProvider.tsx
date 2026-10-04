import { DEFAULT_CLOCK_STYLE, isClockStyle, type ClockStyle } from "@entities/zone/clockStyle";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";

import { readAudioCueVolumeDefault, readAudioRepeatDelayDefaults } from "./audioPreferences";
import { readPanelVisibility } from "./panelPreferences";

import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import {
  DEFAULT_DOCKABLE_PANEL_VISIBILITY,
  type DockablePanelId,
  type DockablePanelVisibility
} from "@ui/panels/dockablePanelMetadata";
import { DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS, type AudioRepeatDelaySettings } from "@entities/audio/types";
import {
  DEFAULT_ENCOUNTER_PANEL_ORDER,
  isEncounterPanelOrder,
  type EncounterPanelOrder
} from "@core/encounter/panelLayout";

export const INTERFACE_PREFERENCES_STORAGE_KEY =
  "combat-zone.interface-preferences";

export type ZoneColorDefaults = {
  border: string | null;
  engagement: string | null;
  zone: string | null;
};

export type EncounterCreationTool = "background" | "zone";

export const DEFAULT_ZONE_COLOR_DEFAULTS: ZoneColorDefaults = {
  border: null,
  engagement: null,
  zone: null
};

type DurableInterfacePreferences = {
  audioCueVolumeDefault: number;
  audioMediaKeyScope: "all" | "music";
  audioMasterVolume: number;
  audioRepeatDelayDefaults: AudioRepeatDelaySettings;
  autoSelectActiveActor: boolean;
  enableAssetAnimation: boolean;
  encounterCreationTool: EncounterCreationTool;
  panelOrder: EncounterPanelOrder;
  panelVisibility: DockablePanelVisibility;
  panWithRightClickDrag: boolean;
  healthCounterName: string;
  clockStyleDefault: ClockStyle;
  strikethroughDeadInitiativeNames: boolean;
  zoneColorDefaults: ZoneColorDefaults;
  zoneOpacityDefault: number;
  zoneShowBorderDefault: boolean;
};

type InterfacePreferences = DurableInterfacePreferences & {
  setAudioCueVolumeDefault: (volume: number) => void;
  setAudioMediaKeyScope: (scope: "all" | "music") => void;
  setAudioMasterVolume: (volume: number) => void;
  setAudioRepeatDelayDefaults: (settings: AudioRepeatDelaySettings) => void;
  autoSelectActiveActorDefault: boolean;
  setAutoSelectActiveActor: (enabled: boolean) => void;
  setEncounterCreationTool: (tool: EncounterCreationTool) => void;
  setPanelOrder: (order: EncounterPanelOrder) => void;
  setEnableAssetAnimation: (enabled: boolean) => void;
  setAutoSelectActiveActorDefault: (enabled: boolean) => void;
  setPanelVisible: (panelId: DockablePanelId, visible: boolean) => void;
  setPanWithRightClickDrag: (enabled: boolean) => void;
  setHealthCounterName: (name: string) => void;
  setClockStyleDefault: (style: ClockStyle) => void;
  setStrikethroughDeadInitiativeNames: (enabled: boolean) => void;
  setZoneColorDefaults: (defaults: ZoneColorDefaults) => void;
  setZoneOpacityDefault: (opacity: number) => void;
  setZoneShowBorderDefault: (showBorder: boolean) => void;
};

const defaultPreferences: DurableInterfacePreferences = {
  audioCueVolumeDefault: 0.5,
  audioMediaKeyScope: "music",
  audioMasterVolume: 1,
  audioRepeatDelayDefaults: { ...DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS },
  autoSelectActiveActor: true,
  enableAssetAnimation: true,
  encounterCreationTool: "zone",
  panelOrder: DEFAULT_ENCOUNTER_PANEL_ORDER,
  panelVisibility: DEFAULT_DOCKABLE_PANEL_VISIBILITY,
  panWithRightClickDrag: true,
  healthCounterName: "Hit points",
  clockStyleDefault: DEFAULT_CLOCK_STYLE,
  strikethroughDeadInitiativeNames: true,
  zoneColorDefaults: DEFAULT_ZONE_COLOR_DEFAULTS,
  zoneOpacityDefault: 0.7,
  zoneShowBorderDefault: true
};

const defaultValue: InterfacePreferences = {
  ...defaultPreferences,
  autoSelectActiveActorDefault: true,
  setAudioCueVolumeDefault: () => undefined,
  setAudioMediaKeyScope: () => undefined,
  setAudioMasterVolume: () => undefined,
  setAudioRepeatDelayDefaults: () => undefined,
  setAutoSelectActiveActor: () => undefined,
  setEncounterCreationTool: () => undefined,
  setPanelOrder: () => undefined,
  setEnableAssetAnimation: () => undefined,
  setAutoSelectActiveActorDefault: () => undefined,
  setPanelVisible: () => undefined,
  setPanWithRightClickDrag: () => undefined,
  setHealthCounterName: () => undefined,
  setClockStyleDefault: () => undefined,
  setStrikethroughDeadInitiativeNames: () => undefined,
  setZoneColorDefaults: () => undefined,
  setZoneOpacityDefault: () => undefined,
  setZoneShowBorderDefault: () => undefined
};

const InterfacePreferenceContext =
  createContext<InterfacePreferences>(defaultValue);

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function readPreferences(): DurableInterfacePreferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY) ?? "null"
    ) as Partial<DurableInterfacePreferences> | null;
    return {
      audioCueVolumeDefault: readAudioCueVolumeDefault(stored?.audioCueVolumeDefault),
      audioMediaKeyScope: stored?.audioMediaKeyScope === "all" ? "all" : "music",
      audioMasterVolume:
        typeof stored?.audioMasterVolume === "number" && stored.audioMasterVolume >= 0 && stored.audioMasterVolume <= 1
          ? stored.audioMasterVolume
          : 1,
      audioRepeatDelayDefaults: readAudioRepeatDelayDefaults(stored?.audioRepeatDelayDefaults),
      autoSelectActiveActor:
        typeof stored?.autoSelectActiveActor === "boolean"
          ? stored.autoSelectActiveActor
          : true,
      enableAssetAnimation:
        typeof stored?.enableAssetAnimation === "boolean"
          ? stored.enableAssetAnimation
          : true,
      encounterCreationTool:
        stored?.encounterCreationTool === "background" ||
        stored?.encounterCreationTool === "zone"
          ? stored.encounterCreationTool
          : defaultPreferences.encounterCreationTool,
      panelOrder: isEncounterPanelOrder(stored?.panelOrder)
        ? stored.panelOrder
        : DEFAULT_ENCOUNTER_PANEL_ORDER,
      panelVisibility: readPanelVisibility(stored?.panelVisibility),
      panWithRightClickDrag:
        typeof stored?.panWithRightClickDrag === "boolean"
          ? stored.panWithRightClickDrag
          : true,
      clockStyleDefault: isClockStyle(stored?.clockStyleDefault) ? stored.clockStyleDefault : DEFAULT_CLOCK_STYLE,
      healthCounterName: typeof stored?.healthCounterName === "string" && stored.healthCounterName.trim() ? stored.healthCounterName.trim() : "Hit points",
      strikethroughDeadInitiativeNames:
        typeof stored?.strikethroughDeadInitiativeNames === "boolean"
          ? stored.strikethroughDeadInitiativeNames
          : true,
      zoneColorDefaults: {
        border: isHexColor(stored?.zoneColorDefaults?.border)
          ? stored.zoneColorDefaults.border.toLowerCase()
          : null,
        engagement: isHexColor(stored?.zoneColorDefaults?.engagement)
          ? stored.zoneColorDefaults.engagement.toLowerCase()
          : null,
        zone: isHexColor(stored?.zoneColorDefaults?.zone)
          ? stored.zoneColorDefaults.zone.toLowerCase()
          : null
      },
      zoneOpacityDefault:
        typeof stored?.zoneOpacityDefault === "number" &&
        stored.zoneOpacityDefault >= 0 &&
        stored.zoneOpacityDefault <= 1
          ? stored.zoneOpacityDefault
          : defaultPreferences.zoneOpacityDefault,
      zoneShowBorderDefault:
        typeof stored?.zoneShowBorderDefault === "boolean"
          ? stored.zoneShowBorderDefault
          : true
    };
  } catch {
    return defaultPreferences;
  }
}

/** Reads the durable creation default for code paths outside the React provider. */
export function readPanelOrderPreference(): EncounterPanelOrder {
  return readPreferences().panelOrder;
}

/** Owns durable interface defaults that must not enter encounter history. */
export function InterfacePreferenceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [autoSelectActiveActor, setAutoSelectActiveActor] = useState(
    preferences.autoSelectActiveActor
  );

  useEffect(() => {
    const reset = () => setPreferences(defaultPreferences);
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === INTERFACE_PREFERENCES_STORAGE_KEY) {
        setPreferences(readPreferences());
      }
    };
    globalThis.addEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
    globalThis.addEventListener("storage", syncFromStorage);
    return () => {
      globalThis.removeEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
      globalThis.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  function updatePreferences(update: Partial<typeof defaultPreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...update };
      try {
        localStorage.setItem(
          INTERFACE_PREFERENCES_STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        // Keep the preference usable for this session when storage is unavailable.
      }
      return next;
    });
  }

  return (
    <InterfacePreferenceContext.Provider
      value={{
        ...preferences,
        setAudioCueVolumeDefault: (volume) => updatePreferences({ audioCueVolumeDefault: readAudioCueVolumeDefault(volume) }),
        setAudioMediaKeyScope: (audioMediaKeyScope) => updatePreferences({ audioMediaKeyScope }),
        autoSelectActiveActor,
        autoSelectActiveActorDefault: preferences.autoSelectActiveActor,
        setAudioMasterVolume: (audioMasterVolume) => updatePreferences({ audioMasterVolume }),
        setAudioRepeatDelayDefaults: (settings) => updatePreferences({ audioRepeatDelayDefaults: readAudioRepeatDelayDefaults(settings) }),
        setAutoSelectActiveActor,
        setAutoSelectActiveActorDefault: (enabled) =>
          updatePreferences({ autoSelectActiveActor: enabled }),
        setEncounterCreationTool: (encounterCreationTool) =>
          updatePreferences({ encounterCreationTool }),
        setPanelOrder: (panelOrder) => updatePreferences({ panelOrder }),
        setEnableAssetAnimation: (enabled) =>
          updatePreferences({ enableAssetAnimation: enabled }),
        setPanelVisible: (panelId, visible) =>
          updatePreferences({
            panelVisibility: {
              ...preferences.panelVisibility,
              [panelId]: visible
            }
          }),
        setPanWithRightClickDrag: (enabled) =>
          updatePreferences({ panWithRightClickDrag: enabled }),
        setClockStyleDefault: (style) => { if (isClockStyle(style)) updatePreferences({ clockStyleDefault: style }); },
        setHealthCounterName: (name) => updatePreferences({ healthCounterName: name.trim() || "Hit points" }),
        setStrikethroughDeadInitiativeNames: (enabled) =>
          updatePreferences({ strikethroughDeadInitiativeNames: enabled }),
        setZoneColorDefaults: (zoneColorDefaults) =>
          updatePreferences({ zoneColorDefaults }),
        setZoneOpacityDefault: (zoneOpacityDefault) =>
          updatePreferences({ zoneOpacityDefault }),
        setZoneShowBorderDefault: (zoneShowBorderDefault) =>
          updatePreferences({ zoneShowBorderDefault })
      }}
    >
      {children}
    </InterfacePreferenceContext.Provider>
  );
}

export function useInterfacePreferences(): InterfacePreferences {
  return useContext(InterfacePreferenceContext);
}
