import { BookHeadphones, CircleUserRound, Globe2, Music3, Pause, Play, Repeat2, Shapes, Square } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { AudioCueType, AudioSectionType } from "@entities/audio/types";
import { setAudioCueType, setAudioCueTypePresets, setAudioSectionType } from "@interaction/interactionState";
import type { ToolDefinition, ToolId } from "@interaction/tools/toolRegistry";
import type { RootState } from "@store/store";
import { useAudioPlayback } from "@ui/audio/AudioPlaybackProvider";
import { useSoundboard } from "@ui/audio/SoundboardProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ToolButton } from "../ToolButton";
import { ToolbarOptionButton, ToolbarOptionGroup, ToolbarOptionRow, ToolbarSubtoolBar } from "../ToolbarOption";

type Props = { activeToolId: ToolId | null; compactLayout: boolean; compactSubtoolHost: HTMLDivElement | null; encounterId: string; tool: ToolDefinition };

const OWNERS = [
  { value: "encounter" as const, label: "Encounter audio", Icon: Globe2 },
  { value: "zone" as const, label: "Zone audio", Icon: Shapes },
  { value: "actor" as const, label: "Actor audio", Icon: CircleUserRound }
];
const TYPES = [
  { value: "loop" as const, label: "Loop cue", Icon: Repeat2 },
  { value: "one_shot" as const, label: "Effect cue", Icon: Music3 }
];

export function AudioToolButton({ activeToolId, compactLayout, compactSubtoolHost, encounterId, tool }: Props) {
  const dispatch = useDispatch();
  const audioTool = useSelector((state: RootState) => state.interaction.audioTool);
  const preferences = useInterfacePreferences();
  const playback = useAudioPlayback();
  const { openSoundboard, soundboardOpen } = useSoundboard();
  const initializedEncounter = useRef<string | null>(null);

  useEffect(() => {
    if (initializedEncounter.current === encounterId) return;
    initializedEncounter.current = encounterId;
    dispatch(setAudioCueTypePresets(preferences.audioCueTypeDefaults));
  }, [dispatch, encounterId, preferences.audioCueTypeDefaults]);

  const optionBar = activeToolId === "audio" ? <ToolbarSubtoolBar aria-label="Audio options">
    <ToolbarOptionGroup aria-label="Audio utilities" role="group">
      <ToolbarOptionButton active={soundboardOpen} aria-label="Open Soundboard" aria-pressed={soundboardOpen} onClick={openSoundboard} title={soundboardOpen ? "Soundboard open" : "Soundboard"} type="button"><BookHeadphones aria-hidden="true" className="h-4 w-4" /></ToolbarOptionButton>
      <ToolbarOptionButton aria-label="Stop all audio" disabled={!playback.hasPlayback} onClick={playback.stopAll} title="Stop all audio" type="button"><Square aria-hidden="true" className="h-4 w-4 fill-current" /></ToolbarOptionButton>
      <ToolbarOptionButton aria-label={playback.hasPausedPlayback ? "Resume paused audio" : "Pause all audio"} disabled={!playback.hasPlayback} onClick={playback.hasPausedPlayback ? playback.resumeAll : playback.pauseAll} title={playback.hasPausedPlayback ? "Resume paused audio" : "Pause all audio"} type="button">{playback.hasPausedPlayback ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}</ToolbarOptionButton>
    </ToolbarOptionGroup>
    <ToolbarOptionGroup aria-label="Audio section" role="radiogroup">{OWNERS.map(({ Icon, label, value }) => <ToolbarOptionButton active={audioTool.sectionType === value} aria-checked={audioTool.sectionType === value} aria-label={label} key={value} onClick={() => dispatch(setAudioSectionType(value as AudioSectionType))} role="radio" title={label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></ToolbarOptionButton>)}</ToolbarOptionGroup>
    <ToolbarOptionGroup aria-label="Audio cue type" role="radiogroup">{TYPES.map(({ Icon, label, value }) => {
      const disabled = (audioTool.sectionType === "actor" || audioTool.sectionType === "zone") && value === "loop";
      return <ToolbarOptionButton active={audioTool.cueTypeBySection[audioTool.sectionType] === value} aria-checked={audioTool.cueTypeBySection[audioTool.sectionType] === value} aria-label={label} disabled={disabled} key={value} onClick={() => dispatch(setAudioCueType(value as AudioCueType))} role="radio" title={disabled ? "Zone and Actor groups use Effects." : label} type="button"><Icon aria-hidden="true" className="h-4 w-4" /></ToolbarOptionButton>;
    })}</ToolbarOptionGroup>
  </ToolbarSubtoolBar> : null;
  return <><ToolbarOptionRow className="max-lg:contents"><ToolButton activeToolId={activeToolId} tool={tool} />{!compactLayout ? optionBar : null}</ToolbarOptionRow>{compactLayout && compactSubtoolHost && optionBar ? createPortal(optionBar, compactSubtoolHost) : null}</>;
}
