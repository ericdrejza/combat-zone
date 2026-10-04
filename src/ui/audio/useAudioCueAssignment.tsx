import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createAudioCue, createAudioCueGroup, setEntityAudioGroups, updateAudioCue } from "@entities/audio/audioMutations";
import type { AudioCueGroupSection, AudioCuePlacement, AudioCueType, AudioSectionType } from "@entities/audio/types";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode } from "@library/types";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { AudioDestinationDialog } from "./AudioDestinationDialog";
import { getAudioDestinationSections } from "./audioDestinations";
import { AudioDirectoryDialog } from "./AudioDirectoryDialog";
import { getDirectoryAudioNodes } from "./audioLibraryDirectory";
import { useAudioPlayback } from "./AudioPlaybackProvider";

type DestinationRequest = { cueType: AudioCueType; sectionType: AudioSectionType; selectedEntityId: string | null };
type Pending = DestinationRequest & { encounterId: string; node: LibraryNode; nodes: LibraryNode[]; placement?: AudioCuePlacement; askSubdirectories?: boolean };

/** Shares explicit destinations and atomic history commits across Library entry points. */
export function useAudioCueAssignment() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const audioLibrary = useSelector((state: RootState) => state.library.sections.audio);
  const activeToolId = useSelector((state: RootState) => state.interaction.activeToolId);
  const audioTool = useSelector((state: RootState) => state.interaction.audioTool);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const preferences = useInterfacePreferences();
  const playback = useAudioPlayback();
  const [pending, setPending] = useState<Pending | null>(null);

  function requestDestination(node: LibraryNode, options?: Partial<DestinationRequest>) {
    const sectionType = options?.sectionType ?? (activeToolId === "audio" ? audioTool.sectionType : "encounter");
    const cueType = options?.cueType ?? (activeToolId === "audio" ? audioTool.cueTypeBySection[sectionType] : "track");
    const selectedEntityId = options?.selectedEntityId ?? (selection.selectedEntityType === sectionType && selection.selectedIds.length === 1 ? selection.selectedIds[0] : null);
    prepare({ cueType, encounterId: encounter.id, node, sectionType, selectedEntityId, nodes: [] });
  }

  function addToGroup(node: LibraryNode, placement: AudioCuePlacement) {
    const group = encounter.audioCueGroups.byId[placement.groupId];
    if (!group) return;
    const type = group.section === "music" || group.section === "ambiance" ? "track" : "effect";
    prepare({ cueType: type, encounterId: encounter.id, node, sectionType: group.section === "zone" || group.section === "actor" ? group.section : "encounter", selectedEntityId: null, nodes: [], placement });
  }

  function prepare(request: Pending) {
    const { node } = request;
    if (node.type === "folder") {
      const nodes = getDirectoryAudioNodes(audioLibrary, node, true);
      if (!nodes.length) return;
      const askSubdirectories = (node.childIds ?? []).some((id) => audioLibrary.nodesById[id]?.type === "folder");
      if (askSubdirectories) setPending({ ...request, nodes, askSubdirectories });
      else proceed({ ...request, nodes });
    } else if (resolveLibraryAsset(audioLibrary, node.id)) proceed({ ...request, nodes: [node] });
  }

  function proceed(request: Pending) {
    if (request.placement) {
      commitCues(encounter, request.nodes, request.placement, request.cueType);
      setPending(null);
    } else setPending({ ...request, askSubdirectories: false });
  }

  function commitCues(state: typeof encounter, nodes: LibraryNode[], placement: AudioCuePlacement, type: AudioCueType, newGroupId?: string) {
    let nextEncounter = state;
    const cueIds: string[] = [];
    for (const node of nodes) {
      if (!resolveLibraryAsset(audioLibrary, node.id)) continue;
      const cueId = `audio-${crypto.randomUUID()}`;
      const next = createAudioCue(nextEncounter, {
        id: cueId, libraryNodeId: node.id, placement, type,
        repeatDelay: { ...preferences.audioRepeatDelayDefaults }, volume: preferences.audioCueVolumeDefault
      });
      if (next !== nextEncounter) cueIds.push(cueId);
      nextEncounter = next;
    }
    if (!cueIds.length) return;
    const single = cueIds.length === 1;
    dispatch(commitEncounterChange({
      action: createEncounterActionRecord(
        newGroupId ? single ? "audio.createGroupWithCue" : "audio.createGroupWithCues" : single ? "audio.createCue" : "audio.createCues",
        { ...(single ? { cueId: cueIds[0], libraryNodeId: nodes[0].id } : { cueIds, libraryNodeIds: nodes.map((node) => node.id) }), ...(newGroupId ? { groupId: newGroupId } : {}) }
      ),
      nextEncounter
    }));
  }

  function choose(placement: AudioCuePlacement) {
    if (!pending || pending.encounterId !== encounter.id) return;
    const group = encounter.audioCueGroups.byId[placement.groupId];
    if (!group || !getAudioDestinationSections(pending.sectionType, pending.cueType).includes(group.section)) return;
    commitCues(encounter, pending.nodes, placement, pending.cueType);
    setPending(null);
  }

  function createGroup(section: AudioCueGroupSection, name: string) {
    if (!pending || pending.encounterId !== encounter.id || !getAudioDestinationSections(pending.sectionType, pending.cueType).includes(section)) return;
    const groupId = `audio-group-${crypto.randomUUID?.() ?? Date.now()}`;
    let nextEncounter = createAudioCueGroup(encounter, { id: groupId, name, section });
    if (pending.selectedEntityId && (section === "zone" || section === "actor")) {
      const entity = section === "zone" ? encounter.zones.byId[pending.selectedEntityId] : encounter.actors.byId[pending.selectedEntityId];
      if (!entity) return;
      nextEncounter = setEntityAudioGroups(nextEncounter, section, entity.id, [...(entity.audioGroupIds ?? []), groupId]);
    }
    commitCues(nextEncounter, pending.nodes, { type: "group", groupId }, pending.cueType, groupId);
    setPending(null);
  }

  return {
    addToGroup, requestDestination,
    relink: (cueId: string, node: LibraryNode) => {
      if (!encounter.audioCues.byId[cueId] || !resolveLibraryAsset(audioLibrary, node.id)) return;
      playback.stop(cueId);
      dispatch(commitEncounterChange({ action: createEncounterActionRecord("audio.relinkCue", { cueId, libraryNodeId: node.id }), nextEncounter: updateAudioCue(encounter, cueId, { libraryNodeId: node.id }) }));
    },
    dialog: pending && pending.encounterId === encounter.id ? pending.askSubdirectories
      ? <AudioDirectoryDialog name={pending.node.name} directCount={getDirectoryAudioNodes(audioLibrary, pending.node, false).length} totalCount={pending.nodes.length} onCancel={() => setPending(null)} onChoose={(recursive) => proceed({ ...pending, nodes: getDirectoryAudioNodes(audioLibrary, pending.node, recursive), askSubdirectories: false })} />
      : <AudioDestinationDialog audioLibrary={audioLibrary} cueType={pending.cueType} cueCount={pending.nodes.length} encounter={encounter} node={pending.node} onCancel={() => setPending(null)} onChoose={choose} onCreateGroup={createGroup} sectionType={pending.sectionType} selectedEntityId={pending.selectedEntityId} /> : null
  };
}
