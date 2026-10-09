import { isClockStyle } from "@entities/zone/clockStyle";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { readAudioCueVolumeDefault, readAudioRepeatDelayDefaults } from "./audioPreferences";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import type { EncounterPanelOrder } from "@core/encounter/panelLayout";
import { INTERFACE_PREFERENCES_STORAGE_KEY, defaultPreferences, defaultValue, readPreferences, type InterfacePreferences } from "./interfacePreferenceStorage";
export { INTERFACE_PREFERENCES_STORAGE_KEY, DEFAULT_ZONE_COLOR_DEFAULTS } from "./interfacePreferenceStorage";
export type { ZoneColorDefaults, EncounterCreationTool } from "./interfacePreferenceStorage";

const InterfacePreferenceContext =
  createContext<InterfacePreferences>(defaultValue);

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
        setWarnActorDestinationsDiffer: (enabled) => updatePreferences({ warnActorDestinationsDiffer: enabled }),
        setKeepHealDamageDialogOpen: (enabled) => updatePreferences({ keepHealDamageDialogOpen: enabled }),
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
