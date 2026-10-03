import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createAudioCue, createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import type { AudioCueGroupSection, AudioCuePlacement, AudioCueType, AudioSectionType } from "@entities/audio/types";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode } from "@library/types";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { AudioDestinationDialog } from "./AudioDestinationDialog";
import { getAudioDestinationSections } from "./audioDestinations";

type DestinationRequest = { cueType: AudioCueType; sectionType: AudioSectionType; selectedEntityId: string | null };
type Pending = DestinationRequest & { encounterId: string; node: LibraryNode };

/** Shares explicit destinations and atomic history commits across Library entry points. */
export function useAudioCueAssignment() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const audioLibrary = useSelector((state: RootState) => state.library.sections.audio);
  const activeToolId = useSelector((state: RootState) => state.interaction.activeToolId);
  const audioTool = useSelector((state: RootState) => state.interaction.audioTool);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const preferences = useInterfacePreferences();
  const [pending, setPending] = useState<Pending | null>(null);

  function requestDestination(node: LibraryNode, options?: Partial<DestinationRequest>) {
    if (!resolveLibraryAsset(audioLibrary, node.id)) return;
    const sectionType = options?.sectionType ?? (activeToolId === "audio" ? audioTool.sectionType : "encounter");
    const cueType = options?.cueType ?? (activeToolId === "audio" ? audioTool.cueTypeBySection[sectionType] : preferences.audioCueTypeDefaults.encounter);
    const selectedEntityId = options?.selectedEntityId ?? (selection.selectedEntityType === sectionType && selection.selectedIds.length === 1 ? selection.selectedIds[0] : null);
    setPending({ cueType, encounterId: encounter.id, node, sectionType, selectedEntityId });
  }

  function addToGroup(node: LibraryNode, placement: AudioCuePlacement) {
    if (!resolveLibraryAsset(audioLibrary, node.id)) return;
    const group = encounter.audioCueGroups.byId[placement.groupId];
    if (!group) return;
    const type = group.section === "music" ? "loop" : group.section === "ambiance" ? preferences.audioCueTypeDefaults.encounter : preferences.audioCueTypeDefaults[group.section];
    commitCue(encounter, node, placement, type);
  }

  function commitCue(state: typeof encounter, node: LibraryNode, placement: AudioCuePlacement, type: AudioCueType, newGroupId?: string) {
    const cueId = `audio-${crypto.randomUUID?.() ?? Date.now()}`;
    const nextEncounter = createAudioCue(state, {
      id: cueId, libraryNodeId: node.id, placement, type,
      repeatDelay: { ...preferences.audioRepeatDelayDefaults }, volume: preferences.audioCueVolumeDefault
    });
    if (nextEncounter === state) return;
    dispatch(commitEncounterChange({
      action: createEncounterActionRecord(newGroupId ? "audio.createGroupWithCue" : "audio.createCue", { cueId, libraryNodeId: node.id, ...(newGroupId ? { groupId: newGroupId } : {}) }),
      nextEncounter
    }));
  }

  function choose(placement: AudioCuePlacement) {
    if (!pending || pending.encounterId !== encounter.id) return;
    const group = encounter.audioCueGroups.byId[placement.groupId];
    if (!group || !getAudioDestinationSections(pending.sectionType, pending.cueType).includes(group.section)) return;
    commitCue(encounter, pending.node, placement, pending.cueType);
    setPending(null);
  }

  function createGroup(section: AudioCueGroupSection) {
    if (!pending || pending.encounterId !== encounter.id || !getAudioDestinationSections(pending.sectionType, pending.cueType).includes(section)) return;
    const groupId = `audio-group-${crypto.randomUUID?.() ?? Date.now()}`;
    let nextEncounter = createAudioCueGroup(encounter, { id: groupId, section });
    if (pending.selectedEntityId && (section === "zone" || section === "actor")) {
      const entity = section === "zone" ? encounter.zones.byId[pending.selectedEntityId] : encounter.actors.byId[pending.selectedEntityId];
      if (!entity) return;
      nextEncounter = setEntityAudioGroups(nextEncounter, section, entity.id, [...(entity.audioGroupIds ?? []), groupId]);
    }
    commitCue(nextEncounter, pending.node, { type: "group", groupId }, pending.cueType, groupId);
    setPending(null);
  }

  return {
    addToGroup, requestDestination,
    dialog: pending && pending.encounterId === encounter.id ? <AudioDestinationDialog audioLibrary={audioLibrary} cueType={pending.cueType} encounter={encounter} node={pending.node} onCancel={() => setPending(null)} onChoose={choose} onCreateGroup={createGroup} sectionType={pending.sectionType} selectedEntityId={pending.selectedEntityId} /> : null
  };
}
