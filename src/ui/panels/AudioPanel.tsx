import { MoveDown, MoveUp, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { renameAudioCueGroup, setMusicGroupOrder } from "@entities/audio/audioMutations";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { AudioPanelSection } from "./AudioPanelSection";
import { AudioGroupMemberBadge } from "./AudioGroupMemberBadge";
import { AudioTransportControls } from "@ui/audio/AudioTransportControls";
import { AudioCueRow } from "@ui/audio/AudioCueRow";
import { getAudioSections, type AudioDisplayGroup } from "@ui/audio/audioGroups";
import { SoundboardLauncherButton } from "@ui/audio/SoundboardLauncherButton";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";

export function AudioPanel({ showVolume }: { showVolume: boolean }) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const preferences = useInterfacePreferences();
  const [masterVolume, setMasterVolume] = useState(preferences.audioMasterVolume);
  const committedMasterVolume = useRef(preferences.audioMasterVolume);
  useEffect(() => {
    setMasterVolume(preferences.audioMasterVolume);
    committedMasterVolume.current = preferences.audioMasterVolume;
  }, [preferences.audioMasterVolume]);

  function commit(nextEncounter: typeof encounter, type: string, payload: Parameters<typeof createEncounterActionRecord>[1]) {
    if (nextEncounter === encounter) return;
    dispatch(commitEncounterChange({ action: createEncounterActionRecord(type, payload), nextEncounter }));
  }
  function commitMasterVolume(nextVolume = masterVolume) {
    if (nextVolume === committedMasterVolume.current) return;
    committedMasterVolume.current = nextVolume;
    preferences.setAudioMasterVolume(nextVolume);
  }
  const selectedEntity = selection.selectedIds.length === 1 && (selection.selectedEntityType === "zone" || selection.selectedEntityType === "actor")
    ? encounter[selection.selectedEntityType === "zone" ? "zones" : "actors"].byId[selection.selectedIds[0]]
    : null;

  return <div className="space-y-3">
    <AudioTransportControls />
    {showVolume ? <label className="block text-xs text-canvas-muted">Master volume: {Math.round(masterVolume * 100)}%<input aria-label="Audio panel master volume" className="mt-1 w-full" max="100" min="0" onBlur={() => commitMasterVolume()} onChange={(event) => setMasterVolume(Number(event.target.value) / 100)} onKeyUp={() => commitMasterVolume()} onPointerUp={(event) => commitMasterVolume(Number(event.currentTarget.value) / 100)} type="range" value={Math.round(masterVolume * 100)} /></label> : null}
    {getAudioSections(encounter).filter((section) => !selectedEntity || section.id === selection.selectedEntityType).map((section) => {
      const selectedIds = selectedEntity?.audioGroupIds ?? [];
      const groups = selectedEntity ? section.groups.filter((group) => selectedIds.includes(group.id)) : section.groups;
      if (section.id === "encounter") {
        const ambiance = groups.filter((group) => group.section === "ambiance");
        const music = groups.filter((group) => group.section === "music");
        return <AudioPanelSection key={section.id} label="Encounter" scope="encounter"><AudioPanelSection label="Ambience" scope="ambiance" subsection>{ambiance.map((group) => <AudioGroupCard encounter={encounter} group={group} key={group.id} onCommit={commit} showVolume={showVolume} />)}</AudioPanelSection><AudioPanelSection label="Music" scope="music" subsection>{music.map((group) => <AudioGroupCard encounter={encounter} group={group} key={group.id} onCommit={commit} onMove={(offset) => {
          const index = encounter.musicGroupIds.indexOf(group.id);
          const target = index + offset;
          if (index < 0 || target < 0 || target >= encounter.musicGroupIds.length) return;
          const next = [...encounter.musicGroupIds];
          [next[index], next[target]] = [next[target], next[index]];
          commit(setMusicGroupOrder(encounter, next), "audio.reorderGroups", { groupId: group.id });
        }} showVolume={showVolume} />)}{music.length === 0 ? <p className="text-xs text-canvas-muted">No music groups.</p> : null}</AudioPanelSection></AudioPanelSection>;
      }
      return <AudioPanelSection key={section.id} label={section.label} scope={section.id}>{groups.map((group) => <AudioGroupCard encounter={encounter} group={group} key={group.id} onCommit={commit} showVolume={showVolume} />)}{groups.length === 0 ? <p className="text-xs text-canvas-muted">No assigned audio groups.</p> : null}</AudioPanelSection>;
    })}
  </div>;
}

function AudioGroupCard({ encounter, group, onCommit, onMove, showVolume }: { encounter: RootState["encounter"]["present"]; group: AudioDisplayGroup; onCommit: (next: RootState["encounter"]["present"], type: string, payload: Parameters<typeof createEncounterActionRecord>[1]) => void; onMove?: (offset: number) => void; showVolume: boolean }) {
  return <motion.article className="space-y-2 rounded-xl border border-canvas-line bg-canvas-surface p-3" layout="position"><div className="flex items-center gap-2"><input aria-label={`Name for ${group.label}`} className="min-w-0 flex-1 bg-transparent font-semibold" defaultValue={group.label} onBlur={(event) => onCommit(renameAudioCueGroup(encounter, group.id, event.currentTarget.value), "audio.renameGroup", { groupId: group.id })} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />{encounter.audioCueGroups.byId[group.id] ? <AudioGroupMemberBadge encounter={encounter} group={encounter.audioCueGroups.byId[group.id]} /> : null}{onMove ? <span className="flex gap-1"><button aria-label={`Move ${group.label} up`} className="text-canvas-muted hover:text-canvas-ink disabled:cursor-default disabled:opacity-30" disabled={encounter.musicGroupIds.indexOf(group.id) === 0} onClick={() => onMove(-1)} type="button"><MoveUp aria-hidden="true" className="h-4 w-4" /></button><button aria-label={`Move ${group.label} down`} className="text-canvas-muted hover:text-canvas-ink disabled:cursor-default disabled:opacity-30" disabled={encounter.musicGroupIds.indexOf(group.id) === encounter.musicGroupIds.length - 1} onClick={() => onMove(1)} type="button"><MoveDown aria-hidden="true" className="h-4 w-4" /></button></span> : null}</div>{group.cues.length ? group.cues.map((cue) => <AudioCueRow cue={cue} key={cue.id} showVolume={showVolume} />) : <p className="text-xs text-canvas-muted">No cues.</p>}</motion.article>;
}

export function AudioPanelHeaderActions({ onToggleVolume, showVolume }: { onToggleVolume: () => void; showVolume: boolean }) {
  const buttonClass = "flex h-8 w-8 items-center justify-center rounded-full border transition";
  return <><SoundboardLauncherButton /><button aria-label={showVolume ? "Hide audio cue volumes" : "Show audio cue volumes"} aria-pressed={showVolume} className={`${buttonClass} ${showVolume ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"}`} onClick={onToggleVolume} title={showVolume ? "Cue volumes shown" : "Cue volumes hidden"} type="button"><Volume2 aria-hidden="true" className="h-4 w-4" /></button></>;
}
