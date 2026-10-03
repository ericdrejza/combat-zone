import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import type { AudioCue } from "@entities/audio/types";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { RootState } from "@store/store";
import { AUDIO_TRIGGER_EVENT, type AudioTriggerRequest } from "./audioTriggerEvents";
import { useAudioPlayback } from "./AudioPlaybackProvider";

function TriggeredCue({ cue }: { cue: AudioCue }) {
  const section = useSelector((state: RootState) => state.library.sections.audio);
  const sourceUrl = useResolvedImageSource(resolveLibraryAsset(section, cue.libraryNodeId)?.source);
  const playback = useAudioPlayback();
  useEffect(() => sourceUrl ? playback.registerCueSource(cue, sourceUrl) : undefined, [cue, playback.registerCueSource, sourceUrl]);
  useEffect(() => () => playback.stop(cue.id), [cue.id, playback.stop]);
  return null;
}

export function AudioTriggerBridge() {
  const encounterId = useSelector((state: RootState) => state.encounter.present.id);
  const cues = useSelector((state: RootState) => state.encounter.present.audioCues);
  const groups = useSelector((state: RootState) => state.encounter.present.audioCueGroups);
  const audioLibrary = useSelector((state: RootState) => state.library.sections.audio);
  const playback = useAudioPlayback();
  const previousEncounterId = useRef(encounterId);
  // Other audio elements can take over the OS session; retain the active track.
  useEffect(() => {
    if (!navigator.mediaSession || typeof MediaMetadata === "undefined") return;
    const cue = playback.activeMusicCueId ? cues.byId[playback.activeMusicCueId] : null;
    navigator.mediaSession.metadata = cue ? new MediaMetadata({ title: audioLibrary.nodesById[cue.libraryNodeId]?.name ?? "Music" }) : null;
  }, [audioLibrary, cues, playback]);
  useEffect(() => {
    if (previousEncounterId.current !== encounterId) playback.stopAll();
    previousEncounterId.current = encounterId;
  }, [encounterId, playback.stopAll]);
  useEffect(() => {
    const listener = (event: Event) => {
      for (const request of (event as CustomEvent<AudioTriggerRequest[]>).detail) playback.playRegistered(request.cueId, request.instanceId);
    };
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    return () => window.removeEventListener(AUDIO_TRIGGER_EVENT, listener);
  }, [playback.playRegistered]);
  useEffect(() => {
    playback.setAudioGroupSections(groups.allIds.map((id) => groups.byId[id]));
  }, [groups, playback.setAudioGroupSections]);
  useEffect(() => {
    playback.setMusicGroups(groups.allIds.flatMap((groupId) => {
      const group = groups.byId[groupId];
      if (group.section !== "music") return [];
      return [{ cueIds: cues.allIds.filter((cueId) => {
        const placement = cues.byId[cueId].placement;
        return placement.groupId === groupId;
      }), groupId, repeat: group.repeat }];
    }));
  }, [cues, groups, playback.setMusicGroups]);
  return <>{cues.allIds.map((id) => <TriggeredCue cue={cues.byId[id]} key={id} />)}</>;
}
