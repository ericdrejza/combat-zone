import type { DurableInterfacePreferences } from "./interfacePreferenceStorage";

export const PREFERENCE_CATEGORY_KEYS = {
  audio: ["audioCueVolumeDefault", "audioAmbienceCueTypeDefault", "audioAmbienceDurationThreshold", "audioMusicCueRepeatDefault", "audioMusicGroupLoopDefault", "audioMediaKeyScope", "audioMasterVolume", "audioRepeatDelayDefaults"],
  canvas: ["showActorStatusesOnCanvas", "backgroundResizeOverflowBehavior", "encounterCreationTool", "panWithRightClickDrag", "zoneColorDefaults", "zoneOpacityDefault", "zoneShowBorderDefault", "actorSelectionOutline", "zoneSelectionOutline", "edgeSelectionAnimation", "edgeThickness", "zoneBorderThickness", "actorBorderThickness", "actorSelectionOutlineWidth", "zoneSelectionOutlineWidth"],
  combat: ["warnActorDestinationsDiffer", "keepHealDamageDialogOpen", "healthCounterName", "resourceBar1Color", "resourceBar2Color"],
  interface: ["enableAssetAnimation", "libraryCloseOnOutsideClick", "libraryModalViewDefault", "libraryPanelViewDefault", "libraryGridCardSize", "libraryIndependentGridCardSizes", "libraryGridCardSizes", "panelOrder", "panelVisibility", "autoSelectActiveActor", "strikethroughDeadInitiativeNames", "reverseHealthStatusOrder", "clockStyleDefault"]
} as const satisfies Record<string, readonly (keyof DurableInterfacePreferences)[]>;

export type PreferenceCategory = keyof typeof PREFERENCE_CATEGORY_KEYS;
