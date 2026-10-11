import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { updateAudioCue } from "@entities/audio/audioMutations";
import type { AudioCueGroupSection, AudioCuePlacement, AudioSectionType } from "@entities/audio/types";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode } from "@library/types";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import type { AudioCueTypeChoice } from "@interaction/audioToolTypes";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { resolveAmbienceCueType } from "./ambienceCueDefaults";
import { useAudioCueDurations } from "./useAudioCueDurations";
import { useAudioCueCreation } from "./useAudioCueCreation";
import { AudioDestinationDialog } from "./AudioDestinationDialog";
import { getAudioDestinationSections } from "./audioDestinations";
import { AudioDirectoryDialog } from "./AudioDirectoryDialog";
import { getDirectoryAudioNodes } from "./audioLibraryDirectory";
import { useAudioPlayback } from "./AudioPlaybackProvider";

type DestinationRequest = { cueType: AudioCueTypeChoice; useAmbienceDefault: boolean; sectionType: AudioSectionType; selectedEntityId: string | null };
type Pending = DestinationRequest & { encounterId: string; node: LibraryNode; nodes: LibraryNode[]; placement?: AudioCuePlacement; askSubdirectories?: boolean; durations?: Array<number | null> };

/** Shares explicit destinations and atomic history commits across Library entry points. */
export function useAudioCueAssignment() {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const preferences = useInterfacePreferences();
  const readDurations = useAudioCueDurations();
  const generation = useRef(0);
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const audioLibrary = useSelector((state: RootState) => state.library.sections.audio);
  const activeToolId = useSelector((state: RootState) => state.interaction.activeToolId);
  const audioTool = useSelector((state: RootState) => state.interaction.audioTool);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const createCues = useAudioCueCreation();
  const playback = useAudioPlayback();
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => { generation.current += 1; return () => { generation.current += 1; }; }, [encounter.id]);

  function requestDestination(node: LibraryNode, options?: Partial<DestinationRequest>) {
    const sectionType = options?.sectionType ?? (activeToolId === "audio" ? audioTool.sectionType : "encounter");
    const cueType = options?.cueType ?? (activeToolId === "audio" ? audioTool.cueTypeBySection[sectionType] : "track");
    const selectedEntityId = options?.selectedEntityId ?? (selection.selectedEntityType === sectionType && selection.selectedIds.length === 1 ? selection.selectedIds[0] : null);
    prepare({ cueType, useAmbienceDefault: !options?.cueType && activeToolId !== "audio", encounterId: encounter.id, node, sectionType, selectedEntityId, nodes: [] });
  }

  function addToGroup(node: LibraryNode, placement: AudioCuePlacement, cueType?: AudioCueTypeChoice) {
    const group = encounter.audioCueGroups.byId[placement.groupId];
    if (!group) return;
    const type = group.section === "music" || group.section === "ambiance" ? "track" : "effect";
    prepare({ cueType: cueType ?? type, useAmbienceDefault: cueType === undefined, encounterId: encounter.id, node, sectionType: group.section === "zone" || group.section === "actor" ? group.section : "encounter", selectedEntityId: null, nodes: [], placement });
  }

  function prepare(request: Pending) {
    generation.current += 1;
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
      createCues({ nodes: request.nodes, placement: request.placement, choice: request.cueType, useAmbienceDefault: request.useAmbienceDefault });
      setPending(null);
    } else if (request.cueType === "duration") {
      const current = generation.current;
      setPending(null);
      const assets = request.nodes.map((node) => resolveLibraryAsset(audioLibrary, node.id));
      void readDurations(assets).then((durations) => {
        if (current === generation.current && store.getState().encounter.present.id === request.encounterId) {
          setPending({ ...request, durations, askSubdirectories: false });
        }
      });
    } else setPending({ ...request, askSubdirectories: false });
  }

  function destinationType(request: Pending) {
    if (request.cueType === "duration") {
      return request.nodes.some((node, index) => {
        const asset = resolveLibraryAsset(audioLibrary, node.id);
        return asset && resolveAmbienceCueType("duration_threshold", asset, preferences.audioAmbienceDurationThreshold, request.durations?.[index] ?? null) === "track";
      }) ? "track" : "effect";
    }
    return request.cueType === "asset" ? request.nodes.some((node) => resolveLibraryAsset(audioLibrary, node.id)?.audioIcon === "music") ? "track" : "effect" : request.cueType;
  }

  function choose(placement: AudioCuePlacement) {
    if (!pending || pending.encounterId !== encounter.id) return;
    const group = encounter.audioCueGroups.byId[placement.groupId];
    if (!group || !getAudioDestinationSections(pending.sectionType, destinationType(pending)).includes(group.section)) return;
    createCues({ nodes: pending.nodes, placement, choice: pending.cueType, useAmbienceDefault: pending.useAmbienceDefault, durations: pending.durations });
    setPending(null);
  }

  function createGroup(section: AudioCueGroupSection, name: string) {
    if (!pending || pending.encounterId !== encounter.id || !getAudioDestinationSections(pending.sectionType, destinationType(pending)).includes(section)) return;
    const groupId = `audio-group-${crypto.randomUUID?.() ?? Date.now()}`;
    createCues({ nodes: pending.nodes, placement: { type: "group", groupId }, choice: pending.cueType, useAmbienceDefault: pending.useAmbienceDefault, durations: pending.durations, newGroup: { id: groupId, name, section, selectedEntityId: pending.selectedEntityId } });
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
      : <AudioDestinationDialog audioLibrary={audioLibrary} cueType={destinationType(pending)} cueCount={pending.nodes.length} encounter={encounter} node={pending.node} onCancel={() => setPending(null)} onChoose={choose} onCreateGroup={createGroup} sectionType={pending.sectionType} selectedEntityId={pending.selectedEntityId} /> : null
  };
}
