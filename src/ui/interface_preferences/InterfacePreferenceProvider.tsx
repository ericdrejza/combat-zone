import { PREFERENCE_CATEGORY_KEYS } from "./preferenceCategories";
import {
  DEFAULT_ACTOR_SELECTION_OUTLINE_WIDTH, DEFAULT_ZONE_SELECTION_OUTLINE_WIDTH, DEFAULT_EDGE_THICKNESS,
  DEFAULT_ZONE_BORDER_THICKNESS, DEFAULT_ACTOR_BORDER_THICKNESS,
  readSelectionOutlineMode, readSelectionOutlineWidth
} from "./selectionOutlinePreferences";
import { readLibraryGridCardSize, readLibraryViewDefault, readLibraryPanelViewDefault } from "./libraryPreferences";
import { readBackgroundResizeOverflowBehavior } from '@core/encounter/backgroundResizeOverflow';
import { isClockStyle } from "@entities/zone/clockStyle";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { readAudioCueVolumeDefault, readAudioRepeatDelayDefaults, readAmbienceCueTypeDefault, readAmbienceDurationThreshold } from "./audioPreferences";
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

export function readBackgroundResizeOverflowPreference() {
  return readPreferences().backgroundResizeOverflowBehavior;
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

  function updatePreferences(update: Partial<typeof defaultPreferences> | ((current: typeof defaultPreferences) => Partial<typeof defaultPreferences>)) {
    setPreferences((current) => {
      const next = { ...current, ...(typeof update === "function" ? update(current) : update) };
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
        resetCategory: category => {
          const defaults = Object.fromEntries(PREFERENCE_CATEGORY_KEYS[category].map(key => [key, structuredClone(defaultPreferences[key])]));
          updatePreferences(defaults);
          if (category === "interface") setAutoSelectActiveActor(defaultPreferences.autoSelectActiveActor);
        },
        setBackgroundResizeOverflowBehavior: value => updatePreferences({ backgroundResizeOverflowBehavior: readBackgroundResizeOverflowBehavior(value) }),
        setAudioCueVolumeDefault: (volume) => updatePreferences({ audioCueVolumeDefault: readAudioCueVolumeDefault(volume) }),
        setAudioAmbienceCueTypeDefault: (value) => updatePreferences({ audioAmbienceCueTypeDefault: readAmbienceCueTypeDefault(value) }),
        setAudioAmbienceDurationThreshold: (value) => updatePreferences({ audioAmbienceDurationThreshold: readAmbienceDurationThreshold(value) }),
        setAudioMusicCueRepeatDefault: (audioMusicCueRepeatDefault) => updatePreferences({ audioMusicCueRepeatDefault }),
        setAudioMusicGroupLoopDefault: (audioMusicGroupLoopDefault) => updatePreferences({ audioMusicGroupLoopDefault }),
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
        setLibraryCloseOnOutsideClick: (libraryCloseOnOutsideClick) => updatePreferences({ libraryCloseOnOutsideClick }),
        setLibraryModalViewDefault: (view) => updatePreferences({ libraryModalViewDefault: readLibraryViewDefault(view) }),
        setLibraryPanelViewDefault: (view) => updatePreferences({ libraryPanelViewDefault: readLibraryPanelViewDefault(view) }),
        setLibraryGridCardSize: (size) => updatePreferences({ libraryGridCardSize: readLibraryGridCardSize(size) }),
        setLibraryIndependentGridCardSizes: (libraryIndependentGridCardSizes) => updatePreferences({ libraryIndependentGridCardSizes }),
        setLibrarySectionGridCardSize: (sectionId, size) => updatePreferences((current) => ({
          libraryGridCardSizes: { ...current.libraryGridCardSizes, [sectionId]: readLibraryGridCardSize(size) }
        })),
        setPanelOrder: (panelOrder) => updatePreferences({ panelOrder }),
        setActorSelectionOutlineWidth: width => updatePreferences({ actorSelectionOutlineWidth: readSelectionOutlineWidth(width, DEFAULT_ACTOR_SELECTION_OUTLINE_WIDTH) }),
        setZoneBorderThickness: width => updatePreferences({ zoneBorderThickness: readSelectionOutlineWidth(width, DEFAULT_ZONE_BORDER_THICKNESS) }),
        setActorBorderThickness: width => updatePreferences({ actorBorderThickness: readSelectionOutlineWidth(width, DEFAULT_ACTOR_BORDER_THICKNESS) }),
        setEdgeThickness: width => updatePreferences({ edgeThickness: readSelectionOutlineWidth(width, DEFAULT_EDGE_THICKNESS) }),
        setZoneSelectionOutlineWidth: width => updatePreferences({ zoneSelectionOutlineWidth: readSelectionOutlineWidth(width, DEFAULT_ZONE_SELECTION_OUTLINE_WIDTH) }),
        setActorSelectionOutline: mode => updatePreferences({ actorSelectionOutline: readSelectionOutlineMode(mode) }),
        setZoneSelectionOutline: mode => updatePreferences({ zoneSelectionOutline: readSelectionOutlineMode(mode) }),
        setEdgeSelectionAnimation: mode => updatePreferences({ edgeSelectionAnimation: readSelectionOutlineMode(mode) }),
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
        setResourceBar1Color: (color) => { if (/^#[0-9a-f]{6}$/i.test(color)) updatePreferences({ resourceBar1Color: color.toLowerCase() }); },
        setResourceBar2Color: (color) => { if (/^#[0-9a-f]{6}$/i.test(color)) updatePreferences({ resourceBar2Color: color.toLowerCase() }); },
        setHealthCounterName: (name) => updatePreferences({ healthCounterName: name.trim() || "Hit points" }),
        setShowActorStatusesOnCanvas: (showActorStatusesOnCanvas) => updatePreferences({ showActorStatusesOnCanvas }),
        setReverseHealthStatusOrder: (reverseHealthStatusOrder) => updatePreferences({ reverseHealthStatusOrder }),
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
