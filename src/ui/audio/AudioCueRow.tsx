import { AudioLines, BookHeadphones, GripVertical, MoveLeft, MoveRight, Music, Play, Repeat1, Square, Trash2, Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useResolvedImageSource } from "@core/assets/ImageAssetResolver";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { deleteAudioCue, updateAudioCue } from "@entities/audio/audioMutations";
import type { AudioCue, AudioCueTrigger, AudioCueType } from "@entities/audio/types";
import { resolveLibraryAsset } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { useAudioPlayback } from "./AudioPlaybackProvider";
import { CueBehaviorButtons } from "./CueBehaviorButtons";
import { openAudioLibraryForRelink } from "./audioLibraryEvents";
import { AUDIO_REPEAT_DELAYS as DELAYS, formatAudioRepeatDelay as delayLabel } from "./audioRepeatDelay";

type Props = { configurable?: boolean; cue: AudioCue; dropSide?: "before" | "after"; onDragStart?: (event: DragEvent<HTMLElement>, cueId: string) => void; onDropCue?: (cueId: string, side: "before" | "after") => void; onPreviewDrop?: (cueId: string, side: "before" | "after") => void; showVolume?: boolean };

export function AudioCueRow({ configurable = false, cue, dropSide, onDragStart, onDropCue, onPreviewDrop, showVolume = false }: Props) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const audioLibrary = useSelector((state: RootState) => state.library.sections.audio);
  const asset = resolveLibraryAsset(audioLibrary, cue.libraryNodeId);
  const sourceUrl = useResolvedImageSource(asset?.source);
  const playback = useAudioPlayback();
  const group = encounter.audioCueGroups.byId[cue.placement.groupId];
  const status = playback.getStatus(cue.id);
  const progress = playback.getProgress(cue.id);
  const metadataDuration = useAudioDuration(sourceUrl);
  const duration = progress.duration || metadataDuration;
  const active = status !== "idle" && status !== "error";
  const highlighted = status === "playing" || status === "waiting";
  const [volume, setVolume] = useState(cue.volume);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const committedVolume = useRef(cue.volume);
  const name = audioLibrary.nodesById[cue.libraryNodeId]?.name ?? "Missing audio";

  useEffect(() => { setVolume(cue.volume); committedVolume.current = cue.volume; }, [cue.volume]);
  function commit(update: Parameters<typeof updateAudioCue>[2], actionType = "audio.updateCue") {
    const nextEncounter = updateAudioCue(encounter, cue.id, update);
    if (nextEncounter !== encounter) dispatch(commitEncounterChange({ action: createEncounterActionRecord(actionType, { cueId: cue.id }), nextEncounter }));
  }
  function commitVolume(nextVolume = volume) {
    if (nextVolume === committedVolume.current) return;
    committedVolume.current = nextVolume;
    commit({ volume: nextVolume }, "audio.setVolume");
  }
  const typeChoices: Array<{ Icon: typeof Music; label: string; type: AudioCueType }> = [
    { Icon: Music, label: "Track", type: "track" },
    { Icon: AudioLines, label: "Effect", type: "effect" }
  ];
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.3 ? Volume : volume <= 0.7 ? Volume1 : Volume2;
  const repeatIndicator = cue.repeat ? <span aria-label={`Repeating ${name}`} className="inline-flex text-canvas-muted" role="img" title={cue.type === "effect" ? `This sound repeats every ${delayLabel(cue.repeatDelay.minimumDelaySeconds)} to ${delayLabel(cue.repeatDelay.maximumDelaySeconds)}` : "Repeating"}><Repeat1 aria-hidden="true" className="h-3.5 w-3.5" /></span> : null;
  const showCueVolume = configurable || showVolume;
  const playButton = !asset
    ? <button aria-label={`Relink ${name}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500" onClick={() => openAudioLibraryForRelink(cue.id)} title="Choose a new Library audio source" type="button"><BookHeadphones aria-hidden="true" className="h-4 w-4" /></button>
    : <PlayButton active={active} disabled={!active && !sourceUrl} name={name} onClick={() => active ? playback.stop(cue.id) : sourceUrl && void playback.play(cue, sourceUrl)} />;

  return <motion.article className={`group/cue relative space-y-1.5 rounded-lg border ${highlighted ? "border-blue-500" : status === "paused" ? "border-yellow-500" : "border-canvas-line"} bg-canvas-surface p-2`} data-audio-cue-id={cue.id} layout="position" onDragOver={(event) => { if (onDropCue) { event.preventDefault(); onPreviewDrop?.(cue.id, getCueDropSide(event)); } }} onDrop={(event) => { if (onDropCue) { event.stopPropagation(); onDropCue(cue.id, getCueDropSide(event)); } }}>
    {dropSide ? <div aria-label={`Insert cue ${dropSide} ${name}`} aria-orientation="vertical" role="separator" className={`absolute bottom-1 top-1 w-0.5 bg-canvas-ink ${dropSide === "before" ? "-left-1.5" : "-right-1.5"}`} data-testid="cue-drop-preview" /> : null}
    <header className="flex items-center gap-1.5">
      {onDragStart ? <button aria-label={`Reorder ${name}`} className="cursor-grab text-canvas-muted active:cursor-grabbing" draggable onDragStart={(event) => onDragStart(event, cue.id)} title="Drag to reorder cue" type="button"><GripVertical aria-hidden="true" className="h-4 w-4" /></button> : null}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="flex items-center gap-1 text-[11px] text-canvas-muted">{cue.type === "effect" ? <>Effect · {formatTime(duration)}<TriggerIndicators cue={cue} owner={group?.section === "zone" || group?.section === "actor" ? group.section : undefined} /></> : "Track"}{!configurable && cue.type === "track" ? repeatIndicator : null}{status === "paused" ? " · paused" : status === "waiting" ? " · waiting" : ""}</p></div>
      {configurable ? <button aria-label="Delete audio cue" className="flex h-7 w-7 items-center justify-center text-red-600 dark:text-red-500 opacity-0 transition-opacity group-hover/cue:opacity-100 focus:opacity-100" onClick={() => { playback.stop(cue.id); dispatch(commitEncounterChange({ action: createEncounterActionRecord("audio.deleteCue", { cueId: cue.id }), nextEncounter: deleteAudioCue(encounter, cue.id) })); }} type="button"><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></button> : null}
      {!configurable ? playButton : null}
    </header>
    {cue.type === "track" ? <label className="block text-[11px] text-canvas-muted"><span className="flex justify-between"><span>{formatTime(progress.currentTime)}</span><span>{formatTime(duration)}</span></span><input aria-label={`Playback progress for ${name}`} className="w-full" disabled={!active || duration <= 0} max={Math.max(1, duration)} min="0" onChange={(event) => playback.seek(cue.id, Number(event.currentTarget.value))} step="0.1" type="range" value={Math.min(progress.currentTime, Math.max(1, duration))} /></label> : null}
    {configurable ? <div className="space-y-1.5 text-xs">
      <div className="flex items-center gap-1">
        <div aria-label={`Type for ${name}`} className="flex gap-1" role="radiogroup">{typeChoices.filter(({ type }) => group?.section === "music" ? type === "track" : group?.section === "zone" || group?.section === "actor" ? type === "effect" : true).map(({ Icon, label, type }) => <button aria-checked={cue.type === type} aria-label={label} className={`flex h-7 w-7 items-center justify-center rounded-lg border ${cue.type === type ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line text-canvas-muted"}`} key={type} onClick={() => { playback.stop(cue.id); commit({ type }, "audio.setType"); }} role="radio" title={label} type="button"><Icon aria-hidden="true" className="h-3.5 w-3.5" /></button>)}</div>
        <span aria-hidden="true" className="mx-1 h-5 border-l border-canvas-line" />
        <CueBehaviorButtons cue={cue} name={name} onCommit={commit} showTriggers={group?.section === "zone" || group?.section === "actor"} />
        <span className="flex-1" />
        {showCueVolume ? <VolumeControl VolumeIcon={VolumeIcon} commitVolume={commitVolume} name={name} onClose={() => setVolumeOpen(false)} onOpen={() => setVolumeOpen(true)} open={volumeOpen} playbackVolume={(next) => playback.setCueVolume(cue.id, next)} setVolume={setVolume} volume={volume} /> : null}
        {playButton}
      </div>
      {cue.type === "effect" && cue.repeat ? <RepeatDelay cue={cue} onCommit={commit} /> : null}
      {cue.type === "effect" && cue.triggersEnabled && (group?.section === "zone" || group?.section === "actor") ? <TriggerChoices cue={cue} onCommit={commit} owner={group.section} /> : null}
    </div> : showCueVolume || cue.type === "effect" && cue.repeat ? <footer className="flex items-center gap-1">{cue.type === "effect" ? repeatIndicator : null}<span className="flex-1" />{showCueVolume ? <VolumeControl VolumeIcon={VolumeIcon} commitVolume={commitVolume} name={name} onClose={() => setVolumeOpen(false)} onOpen={() => setVolumeOpen(true)} open={volumeOpen} playbackVolume={(next) => playback.setCueVolume(cue.id, next)} setVolume={setVolume} volume={volume} /> : null}</footer> : null}
    {!asset ? <p className="text-xs text-red-600 dark:text-red-500">The referenced Library audio is missing. Relink or remove this cue.</p> : null}
  </motion.article>;
}

function getCueDropSide(event: DragEvent<HTMLElement>): "before" | "after" {
  const bounds = event.currentTarget.getBoundingClientRect();
  return !Number.isFinite(event.clientX) || event.clientX < bounds.left + bounds.width / 2 ? "before" : "after";
}

function PlayButton({ active, disabled, name, onClick }: { active: boolean; disabled: boolean; name: string; onClick: () => void }) {
  return <button aria-label={active ? `Stop ${name}` : `Play ${name}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-canvas-line" disabled={disabled} onClick={onClick} type="button">{active ? <Square aria-hidden="true" className="h-3 w-3 fill-current" /> : <Play aria-hidden="true" className="h-3.5 w-3.5" />}</button>;
}

function VolumeControl({ VolumeIcon, commitVolume, name, onClose, onOpen, open, playbackVolume, setVolume, volume }: { VolumeIcon: typeof Volume; commitVolume: (value?: number) => void; name: string; onClose: () => void; onOpen: () => void; open: boolean; playbackVolume: (value: number) => void; setVolume: (value: number) => void; volume: number }) {
  const controlRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const tooltipId = useId();
  const tooltipVisible = hovered && !open;
  useEffect(() => {
    if (!open) return;
    const ownerDocument = controlRef.current?.ownerDocument;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof (ownerDocument?.defaultView?.Node ?? Node) && !controlRef.current?.contains(event.target as Node)) {
        commitVolume();
        onClose();
      }
    };
    ownerDocument?.addEventListener("pointerdown", dismiss);
    return () => ownerDocument?.removeEventListener("pointerdown", dismiss);
  }, [commitVolume, onClose, open]);
  return <div className="relative" ref={controlRef}><button aria-describedby={tooltipVisible ? tooltipId : undefined} aria-label={`Volume for ${name}: ${Math.round(volume * 100)}%`} aria-expanded={open} className={`flex h-7 w-7 items-center justify-center ${volume === 0 ? "text-red-600 dark:text-red-500" : ""}`} onClick={() => { setHovered(false); open ? onClose() : onOpen(); }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} type="button"><VolumeIcon aria-hidden="true" className="h-4 w-4" /></button>{tooltipVisible ? <span className="pointer-events-none absolute bottom-8 right-0 z-30 whitespace-nowrap rounded-md bg-canvas-ink px-2 py-1 text-xs text-canvas-on-ink shadow-lg" id={tooltipId} role="tooltip">{Math.round(volume * 100)}%</span> : null}{open ? <div className="absolute bottom-8 right-1/2 z-30 flex h-32 translate-x-1/2 flex-col items-center rounded-xl border border-canvas-line bg-canvas-panel p-2 shadow-lg"><input aria-label={`Set volume for ${name}`} className="h-24 w-5 cursor-grab active:cursor-grabbing [direction:rtl] [writing-mode:vertical-lr]" max="100" min="0" onBlur={() => { commitVolume(); onClose(); }} onChange={(event) => { const next = Number(event.currentTarget.value) / 100; setVolume(next); playbackVolume(next); }} onPointerUp={(event) => commitVolume(Number(event.currentTarget.value) / 100)} step="10" type="range" value={Math.round(volume * 100)} /><span className="text-[10px]">{Math.round(volume * 100)}%</span></div> : null}</div>;
}

function getTriggerChoices(owner: "zone" | "actor"): Array<{ Icon: typeof MoveLeft; label: string; trigger: AudioCueTrigger }> {
  return owner === "zone"
    ? [{ Icon: MoveLeft, label: "Entering zone", trigger: "zone_enter" }, { Icon: MoveRight, label: "Leaving zone", trigger: "zone_leave" }]
    : [{ Icon: MoveLeft, label: "Actor enters zone", trigger: "actor_enter_zone" }, { Icon: MoveRight, label: "Actor leaves zone", trigger: "actor_leave_zone" }];
}

function TriggerIndicators({ cue, owner }: { cue: AudioCue; owner?: "zone" | "actor" }) {
  if (!owner || cue.type !== "effect" || !cue.triggersEnabled) return null;
  return <>{getTriggerChoices(owner).filter(({ trigger }) => cue.triggers.includes(trigger)).map(({ Icon, label, trigger }) => <span aria-label={label} className="inline-flex shrink-0" key={trigger} role="img" title={label}><Icon aria-hidden="true" className="h-3.5 w-3.5" /></span>)}</>;
}

function TriggerChoices({ cue, onCommit, owner }: { cue: AudioCue; onCommit: (update: Parameters<typeof updateAudioCue>[2], actionType?: string) => void; owner: "zone" | "actor" }) {
  const choices = getTriggerChoices(owner);
  return <fieldset><legend className="mb-1 text-canvas-muted">Triggers</legend><div className="grid grid-cols-2 gap-1">{choices.map(({ label, trigger }) => <label className="flex min-w-0 items-center gap-1 rounded-lg bg-canvas px-1.5 py-1" key={trigger}><input checked={cue.triggers.includes(trigger)} onChange={(event) => onCommit({ triggers: event.currentTarget.checked ? [...cue.triggers, trigger] : cue.triggers.filter((value) => value !== trigger) }, "audio.setTriggers")} type="checkbox" /><span>{label}</span></label>)}</div></fieldset>;
}

function RepeatDelay({ cue, onCommit }: { cue: AudioCue; onCommit: (update: Parameters<typeof updateAudioCue>[2], actionType?: string) => void }) {
  const value = (seconds: number) => DELAYS.includes(seconds) ? seconds : 0;
  return <div className="rounded-lg bg-canvas p-2 text-xs">Repeat this sound every <select aria-label="Repeat delay from" className="rounded border border-canvas-line bg-canvas-surface px-1 py-0.5" onChange={(event) => { const minimumDelaySeconds = Number(event.target.value); onCommit({ repeatDelay: { ...cue.repeatDelay, minimumDelaySeconds, maximumDelaySeconds: Math.max(minimumDelaySeconds, cue.repeatDelay.maximumDelaySeconds) } }, "audio.setRepeatDelay"); }} value={value(cue.repeatDelay.minimumDelaySeconds)}>{DELAYS.map((seconds) => <option key={seconds} value={seconds}>{delayLabel(seconds)}</option>)}</select> to <select aria-label="Repeat delay to" className="rounded border border-canvas-line bg-canvas-surface px-1 py-0.5" onChange={(event) => onCommit({ repeatDelay: { ...cue.repeatDelay, maximumDelaySeconds: Math.max(cue.repeatDelay.minimumDelaySeconds, Number(event.target.value)) } }, "audio.setRepeatDelay")} value={value(cue.repeatDelay.maximumDelaySeconds)}>{DELAYS.map((seconds) => <option key={seconds} value={seconds}>{delayLabel(seconds)}</option>)}</select></div>;
}

function useAudioDuration(sourceUrl: string | null) {
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    if (!sourceUrl) { setDuration(0); return; }
    const audio = new Audio(sourceUrl);
    audio.preload = "metadata";
    const loaded = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener("loadedmetadata", loaded);
    return () => audio.removeEventListener("loadedmetadata", loaded);
  }, [sourceUrl]);
  return duration;
}

function formatTime(seconds: number) { const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0; return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, "0")}`; }
