import { runEncounterOperation } from "@core/history/encounterOperations";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createAudioCue, createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import type { AudioCueGroupSection, AudioCuePlacement } from "@entities/audio/types";
import type { AudioCueTypeChoice } from "@interaction/audioToolTypes";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode } from "@library/types";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { resolveAmbienceCueType } from "./ambienceCueDefaults";

import { useAudioCueDurations } from "./useAudioCueDurations";

type NewGroup = { id: string; name: string; section: AudioCueGroupSection; selectedEntityId: string | null };
type Request = { nodes: LibraryNode[]; placement: AudioCuePlacement; choice: AudioCueTypeChoice; useAmbienceDefault: boolean; newGroup?: NewGroup; durations?: Array<number | null> };

/** Metadata is read before one atomic command, rebased onto current encounter state. */
export function useAudioCueCreation() {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const encounterId = useSelector((state: RootState) => state.encounter.present.id);
  const preferences = useInterfacePreferences();
  const readDurations = useAudioCueDurations();
  const lifetime = useRef(0);
  useEffect(() => { lifetime.current += 1; return () => { lifetime.current += 1; }; }, [encounterId]);

  return function createCues(request: Request) {
    const generation = lifetime.current;
    const state = store.getState();
    const section = request.newGroup?.section ?? state.encounter.present.audioCueGroups.byId[request.placement.groupId]?.section;
    if (!section) return;
    const mode = request.useAmbienceDefault ? preferences.audioAmbienceCueTypeDefault : request.choice === "asset" ? "asset_icon" : request.choice === "duration" ? "duration_threshold" : request.choice;
    const assets = request.nodes.map((node) => resolveLibraryAsset(state.library.sections.audio, node.id));
    function commit(durations: Array<number | null>) {
      const latest = store.getState();
      if (generation !== lifetime.current || latest.encounter.present.id !== encounterId) return;
      let next = latest.encounter.present;
      if (request.newGroup) {
        const { selectedEntityId, ...group } = request.newGroup;
        next = createAudioCueGroup(next, { ...group, repeat: preferences.audioMusicGroupLoopDefault });
        if (selectedEntityId && (section === "zone" || section === "actor")) {
          const entity = section === "zone" ? next.zones.byId[selectedEntityId] : next.actors.byId[selectedEntityId];
          if (!entity) return;
          next = setEntityAudioGroups(next, section, entity.id, [...(entity.audioGroupIds ?? []), group.id]);
        }
      }
      if (next.audioCueGroups.byId[request.placement.groupId]?.section !== section) return;
      const cueIds: string[] = [];
      const nodeIds: string[] = [];
      request.nodes.forEach((node, index) => {
        const asset = resolveLibraryAsset(latest.library.sections.audio, node.id);
        if (!asset) return;
        const type = section === "music" ? "track" : section === "zone" || section === "actor" ? "effect"
          : resolveAmbienceCueType(mode, asset, preferences.audioAmbienceDurationThreshold, durations[index] ?? null);
        const cueId = `audio-${crypto.randomUUID()}`;
        const changed = createAudioCue(next, {
          id: cueId, libraryNodeId: node.id, placement: request.placement, type,
          repeat: type === "track" ? preferences.audioMusicCueRepeatDefault : false,
          repeatDelay: { ...preferences.audioRepeatDelayDefaults }, volume: preferences.audioCueVolumeDefault
        });
        if (changed !== next) { cueIds.push(cueId); nodeIds.push(node.id); }
        next = changed;
      });
      if (!cueIds.length) return;
      const single = cueIds.length === 1;
      dispatch(commitEncounterChange({
        action: createEncounterActionRecord(
          request.newGroup ? single ? "audio.createGroupWithCue" : "audio.createGroupWithCues" : single ? "audio.createCue" : "audio.createCues",
          { ...(single ? { cueId: cueIds[0], libraryNodeId: nodeIds[0] } : { cueIds, libraryNodeIds: nodeIds }), ...(request.newGroup ? { groupId: request.newGroup.id } : {}) }
        ), nextEncounter: next
      }));
    }
    if (section !== "ambiance" || mode !== "duration_threshold") { commit([]); return; }
    if (request.durations) { commit(request.durations); return; }
    void runEncounterOperation(() => readDurations(assets).then(commit));
  };
}
