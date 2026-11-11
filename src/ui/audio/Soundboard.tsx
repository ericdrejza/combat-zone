import { ChevronDown, ChevronRight, GripVertical, Plus, Repeat, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";

import { getSelectedAudioGroupIds } from "./audioSelection";
import { SoundboardHeader } from "./SoundboardHeader";
import { AudioGroupShuffleButton } from "./AudioGroupShuffleButton";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createAudioCueGroup, deleteAudioCueGroup, moveAudioCue, moveAudioCueGroup, renameAudioCueGroup, setAudioCueGroupRepeat, setAudioCueGroupShuffle } from "@entities/audio/audioMutations";
import type { AudioCueGroupSection, AudioCuePlacement } from "@entities/audio/types";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";
import { GroupPlaybackButton, MusicSectionControls, SectionPlaybackButton } from "./AudioTransportControls";
import { AudioCueRow } from "./AudioCueRow";
import { getAudioSections, type AudioDisplayGroup } from "./audioGroups";
import { openAudioLibraryForCue } from "./audioLibraryEvents";
import type { SoundboardNavigationRequest } from "./soundboardNavigation";
import { useNewAudioGroupScroll } from "./useNewAudioGroupScroll";
import { useSoundboardNavigation } from "./useSoundboardNavigation";
import { AudioGroupMembers } from "./AudioGroupMembers";

type Commit = (next: RootState["encounter"]["present"], type: string, payload: Parameters<typeof createEncounterActionRecord>[1]) => void;
type Dragged = { id: string; kind: "cue" | "group" } | null;
type DropTarget = { id: string; kind: "cue" | "group" | "group_end"; side?: "before" | "after" } | null;

function getGroupDropSide(event: DragEvent<HTMLElement>): "before" | "after" {
  const bounds = event.currentTarget.getBoundingClientRect();
  return !Number.isFinite(event.clientY) || event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}

export function Soundboard({ isPopout = false, navigation, onToggleWindow }: { isPopout?: boolean; navigation?: SoundboardNavigationRequest | null; onToggleWindow: () => void }) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const preferences = useInterfacePreferences();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [highlightSelection, setHighlightSelection] = useState(false);
  const [filterSelection, setFilterSelection] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<Dragged>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  useSoundboardNavigation({ navigation, encounter, scrollRef, collapsedSections, collapsedGroups, setCollapsedSections, setCollapsedGroups });
  useNewAudioGroupScroll(encounter.audioCueGroups.allIds, scrollRef);
  const selectedGroupIds = getSelectedAudioGroupIds(encounter, selection);
  const filtering = filterSelection && selection.selectedIds.length > 0 &&
    (selection.selectedEntityType === "actor" || selection.selectedEntityType === "zone");
  const sections = getAudioSections(encounter).map((section) => ({
    ...section, groups: filtering ? section.groups.filter((group) => selectedGroupIds.has(group.id)) : section.groups
  })).filter((section) => !filtering || section.groups.length > 0);
  const highlightedGroupIds = highlightSelection ? selectedGroupIds : new Set<string>();

  function commit(nextEncounter: typeof encounter, type: string, payload: Parameters<typeof createEncounterActionRecord>[1]) {
    if (nextEncounter !== encounter) dispatch(commitEncounterChange({ action: createEncounterActionRecord(type, payload), nextEncounter }));
  }
  function addGroup(section: AudioCueGroupSection) {
    const groupId = `audio-group-${crypto.randomUUID?.() ?? Date.now()}`;
    commit(createAudioCueGroup(encounter, { id: groupId, section, repeat: preferences.audioMusicGroupLoopDefault }), "audio.createGroup", { groupId, section });
  }
  function toggle(setter: typeof setCollapsedSections, id: string) {
    setter((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function finishDrag() { setDragged(null); setDropTarget(null); }
  function dropCue(placement: AudioCuePlacement, beforeCueId?: string) {
    if (dragged?.kind !== "cue" || beforeCueId === dragged.id) return finishDrag();
    commit(moveAudioCue(encounter, dragged.id, placement, beforeCueId), "audio.moveCue", { cueId: dragged.id });
    finishDrag();
  }
  function dropGroup(section: AudioCueGroupSection, beforeGroupId?: string) {
    if (dragged?.kind !== "group" || beforeGroupId === dragged.id) return finishDrag();
    commit(moveAudioCueGroup(encounter, dragged.id, section, beforeGroupId), "audio.moveGroup", { groupId: dragged.id, section });
    finishDrag();
  }
  function autoScroll(event: DragEvent<HTMLDivElement>) {
    const element = scrollRef.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const edge = 72;
    if (event.clientY < bounds.top + edge) element.scrollBy({ behavior: "auto", top: -18 });
    else if (event.clientY > bounds.bottom - edge) element.scrollBy({ behavior: "auto", top: 18 });
  }
  function addCue(placement: AudioCuePlacement) {
    openAudioLibraryForCue(placement);
  }

  const encounterGroups = sections.find((section) => section.id === "encounter")?.groups ?? [];
  const common = { highlightedGroupIds, collapsedGroups, dragged, dropTarget, encounter, onAddCue: addCue, onCommit: commit, onDelete: setDeleteGroupId, onDrag: setDragged, onDropCue: dropCue, onDropGroup: dropGroup, onDropTarget: setDropTarget, onToggleGroup: (id: string) => toggle(setCollapsedGroups, id) };
  return <div className="h-full overflow-y-auto bg-canvas p-4 text-canvas-ink" onDragEnd={finishDrag} onDragOver={autoScroll} ref={scrollRef}>
    <SoundboardHeader isPopout={isPopout} onToggleWindow={onToggleWindow} highlightSelection={highlightSelection} filterSelection={filterSelection} onToggleHighlight={() => setHighlightSelection((value) => !value)} onToggleFilter={() => setFilterSelection((value) => !value)} />
    <main className="space-y-5">
      {sections.some((section) => section.id === "encounter") ? <section className="space-y-5 rounded-2xl border border-canvas-line bg-canvas-panel p-4"><SectionHeading collapsed={collapsedSections.has("encounter")} label="Encounter" scope="encounter" onToggle={() => toggle(setCollapsedSections, "encounter")} />
        {!collapsedSections.has("encounter") ? <>
          <SoundboardSubsection collapsed={collapsedSections.has("encounter-ambience")} label="Ambience" onToggle={() => toggle(setCollapsedSections, "encounter-ambience")}><GroupList {...common} groups={encounterGroups.filter((group) => group.section === "ambiance")} onAdd={() => addGroup("ambiance")} section="ambiance" /></SoundboardSubsection>
          <SoundboardSubsection collapsed={collapsedSections.has("encounter-music")} label="Music" onToggle={() => toggle(setCollapsedSections, "encounter-music")}><GroupList {...common} groups={encounterGroups.filter((group) => group.section === "music")} onAdd={() => addGroup("music")} section="music" /></SoundboardSubsection>
        </> : null}
      </section> : null}
      {filtering && sections.length === 0 ? <p className="text-sm text-canvas-muted" role="status">No audio groups are assigned to the selected entities.</p> : null}
      {sections.filter((section) => section.id !== "encounter").map((section) => {
        const groupSection = section.id as "zone" | "actor";
        return <section data-audio-section-id={section.id} className="space-y-4 rounded-2xl border border-canvas-line bg-canvas-panel p-4" key={section.id}><SectionHeading collapsed={collapsedSections.has(section.id)} label={section.label} scope={groupSection} onToggle={() => toggle(setCollapsedSections, section.id)} />{!collapsedSections.has(section.id) ? <GroupList {...common} groups={section.groups} onAdd={() => addGroup(groupSection)} section={groupSection} /> : null}</section>;
      })}
    </main>
    {deleteGroupId ? <div aria-label="Delete audio group" aria-modal="true" className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4" role="dialog"><div className="max-w-sm rounded-2xl bg-canvas-panel p-5 shadow-xl"><h3 className="font-semibold">Delete audio group?</h3><p className="mt-2 text-sm text-canvas-muted">This removes its cues and unassigns it from every inheriting entity.</p><div className="mt-4 flex justify-end gap-2"><button onClick={() => setDeleteGroupId(null)} type="button">Cancel</button><button className="rounded-xl bg-red-600 px-3 py-2 text-white" onClick={() => { commit(deleteAudioCueGroup(encounter, deleteGroupId), "audio.deleteGroup", { groupId: deleteGroupId }); setDeleteGroupId(null); }} type="button">Delete</button></div></div></div> : null}
  </div>;
}

function SectionHeading({ collapsed, label, onToggle, scope }: { collapsed: boolean; label: string; onToggle: () => void; scope: "encounter" | "zone" | "actor" }) {
  return <div className="flex items-center justify-between"><h2 className="mr-auto font-display text-lg font-semibold">{label}</h2><SectionPlaybackButton label={label.toLowerCase()} scope={scope} /><CollapseButton collapsed={collapsed} label={label} onClick={onToggle} /></div>;
}
function CollapseButton({ collapsed, label, onClick }: { collapsed: boolean; label: string; onClick: () => void }) {
  return <button aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`} aria-expanded={!collapsed} className="flex h-8 w-8 items-center justify-center rounded-full" onClick={onClick} type="button">{collapsed ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}</button>;
}
function SoundboardSubsection({ children, collapsed, label, onToggle }: { children: ReactNode; collapsed: boolean; label: string; onToggle: () => void }) {
  return <section className="space-y-3"><div className="flex items-center gap-2 border-b border-canvas-line pb-2"><h3 className="mr-auto font-display font-semibold">{label}</h3>{label === "Music" ? <MusicSectionControls /> : <SectionPlaybackButton label="ambience" scope="ambiance" />}<CollapseButton collapsed={collapsed} label={`${label} subsection`} onClick={onToggle} /></div>{collapsed ? null : children}</section>;
}

type GroupListProps = { highlightedGroupIds: Set<string>; collapsedGroups: Set<string>; dragged: Dragged; dropTarget: DropTarget; encounter: RootState["encounter"]["present"]; groups: AudioDisplayGroup[]; onAdd: () => void; onAddCue: (placement: AudioCuePlacement) => void; onCommit: Commit; onDelete: (id: string) => void; onDrag: (dragged: Dragged) => void; onDropCue: (placement: AudioCuePlacement, beforeCueId?: string) => void; onDropGroup: (section: AudioCueGroupSection, beforeGroupId?: string) => void; onDropTarget: (target: DropTarget) => void; onToggleGroup: (id: string) => void; section: AudioCueGroupSection };
function GroupList({ highlightedGroupIds, collapsedGroups, dragged, dropTarget, encounter, groups, onAdd, onAddCue, onCommit, onDelete, onDrag, onDropCue, onDropGroup, onDropTarget, onToggleGroup, section }: GroupListProps) {
  return <div className="group/section space-y-2" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if ((event.target as HTMLElement).closest("[data-audio-group-id]")) return; dragged?.kind === "group" ? onDropGroup(section) : dragged?.kind === "cue" && groups.at(-1) && onDropCue({ type: "group", groupId: groups.at(-1)!.id }); }}>
    <div className="space-y-3">{groups.map((group) => <SoundboardGroup highlighted={highlightedGroupIds.has(group.id)} collapsed={collapsedGroups.has(group.id)} dragged={dragged} dropTarget={dropTarget} encounter={encounter} group={group} key={group.id} onAddCue={onAddCue} onCommit={onCommit} onDelete={() => onDelete(group.id)} onDrag={onDrag} onDropCue={onDropCue} onDropGroup={(targetId, side) => { const following = groups.slice(groups.findIndex((item) => item.id === targetId) + 1).find((item) => item.id !== dragged?.id); onDropGroup(section, side === "before" || targetId === dragged?.id ? targetId : following?.id); }} onDropTarget={onDropTarget} onToggle={() => onToggleGroup(group.id)} />)}</div>
    {dropTarget?.kind === "group_end" && dropTarget.id === section ? <div className="h-0.5 bg-canvas-ink" data-testid="group-drop-preview" /> : null}
    <div className="flex h-9 items-end justify-center" onDragOver={(event) => { event.preventDefault(); if (dragged?.kind === "group") onDropTarget({ id: section, kind: "group_end" }); }}><button className="flex items-center gap-1 rounded-full border border-dashed border-canvas-line px-3 py-1 text-xs opacity-0 transition-opacity hover:border-canvas-ink hover:bg-canvas hover:text-canvas-ink group-hover/section:opacity-100 focus:opacity-100" onClick={onAdd} type="button"><Plus aria-hidden="true" className="h-3.5 w-3.5" />Add new group</button></div>
  </div>;
}

type SoundboardGroupProps = { highlighted: boolean; collapsed: boolean; dragged: Dragged; dropTarget: DropTarget; encounter: RootState["encounter"]["present"]; group: AudioDisplayGroup; onAddCue: (placement: AudioCuePlacement) => void; onCommit: Commit; onDelete: () => void; onDrag: (dragged: Dragged) => void; onDropCue: (placement: AudioCuePlacement, beforeCueId?: string) => void; onDropGroup: (targetId: string, side: "before" | "after") => void; onDropTarget: (target: DropTarget) => void; onToggle: () => void };
function SoundboardGroup({ highlighted, collapsed, dragged, dropTarget, encounter, group, onAddCue, onCommit, onDelete, onDrag, onDropCue, onDropGroup, onDropTarget, onToggle }: SoundboardGroupProps) {
  const { animationsDisabled } = useMotionPreference();
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const placement: AudioCuePlacement = { type: "group", groupId: group.id };
  const persistedGroup = encounter.audioCueGroups.byId[group.id];
  function commitName(element: HTMLInputElement) { onCommit(renameAudioCueGroup(encounter, group.id, element.value), "audio.renameGroup", { groupId: group.id }); }
  function dropAtCue(cueId: string, side: "before" | "after") {
    const nextCue = group.cues.slice(group.cues.findIndex((item) => item.id === cueId) + 1).find((item) => item.id !== dragged?.id);
    onDropCue(placement, side === "before" || cueId === dragged?.id ? cueId : nextCue?.id);
  }
  return <motion.div className="relative" data-audio-group-id={group.id} layout={animationsDisabled ? false : "position"} layoutId={animationsDisabled ? undefined : `soundboard-group-${group.id}`} transition={{ layout: { duration: 0.18, ease: "easeOut" } }} onDragOver={(event) => { event.preventDefault(); if (dragged?.kind === "group") onDropTarget({ id: group.id, kind: "group", side: getGroupDropSide(event) }); }} onDrop={(event) => { event.stopPropagation(); if (dragged?.kind === "group") onDropGroup(group.id, getGroupDropSide(event)); else if (dragged?.kind === "cue" && !(event.target as HTMLElement).closest("[data-audio-cue-id]")) onDropCue(placement); }}>
    {dropTarget?.kind === "group" && dropTarget.id === group.id ? <div aria-label={`Insert group ${dropTarget.side ?? "before"} ${group.label}`} aria-orientation="horizontal" role="separator" className={`absolute left-0 right-0 h-0.5 bg-canvas-ink ${dropTarget.side === "after" ? "-bottom-1.5" : "-top-1.5"}`} data-testid="group-drop-preview" /> : null}
    <article className={`group/group space-y-2 rounded-xl border bg-canvas-surface p-3 ${highlighted ? "border-white ring-1 ring-white shadow-[0_0_12px_rgba(255,255,255,0.7)]" : "border-canvas-line"}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocusWithin(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false); }}>
      <div className="flex items-center gap-2"><input aria-label={`Name for ${group.label}`} className="min-w-0 flex-1 bg-transparent font-semibold" defaultValue={group.label} onBlur={(event) => commitName(event.currentTarget)} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />{collapsed ? <span aria-label={`${group.cues.length} cues in ${group.label}`} className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-canvas-muted">{group.cues.length}</span> : null}{persistedGroup ? <AudioGroupMembers encounter={encounter} group={persistedGroup} /> : null}{hovered || focusWithin ? <button aria-label={`Delete ${group.label}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-600 dark:text-red-500 hover:bg-canvas focus-visible:ring-2 focus-visible:ring-canvas-ink" onClick={onDelete} type="button"><Trash2 aria-hidden="true" className="h-4 w-4" /></button> : null}{group.section === "music" && persistedGroup ? <button aria-label={persistedGroup.repeat ? `Disable repeat for ${group.label}` : `Enable repeat for ${group.label}`} aria-pressed={persistedGroup.repeat} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border hover:ring-2 hover:ring-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink ${persistedGroup.repeat ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line"}`} onClick={() => onCommit(setAudioCueGroupRepeat(encounter, group.id, !persistedGroup.repeat), "audio.setGroupRepeat", { groupId: group.id })} title="Play tracks sequentially and loop this music group. When off, playback stops after the current track finishes." type="button"><Repeat aria-hidden="true" className="h-4 w-4" /></button> : null}{persistedGroup && (group.section === "zone" || group.section === "actor") ? <AudioGroupShuffleButton group={persistedGroup} onToggle={() => onCommit(setAudioCueGroupShuffle(encounter, group.id, !persistedGroup.shuffleTriggers), "audio.setGroupShuffle", { groupId: group.id })} /> : null}<GroupPlaybackButton cueIds={group.cues.map((cue) => cue.id)} groupId={group.id} label={group.label} section={group.section} /><button aria-label={`Reorder ${group.label}`} className="flex h-8 w-8 cursor-grab items-center justify-center text-canvas-muted active:cursor-grabbing" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; onDrag({ id: group.id, kind: "group" }); }} type="button"><GripVertical aria-hidden="true" className="h-4 w-4" /></button><CollapseButton collapsed={collapsed} label={group.label} onClick={onToggle} /></div>
      {!collapsed ? <div className="grid gap-2 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{group.cues.map((cue) => <AudioCueRow configurable cue={cue} dropSide={dropTarget?.kind === "cue" && dropTarget.id === cue.id ? dropTarget.side ?? "before" : undefined} key={cue.id} onDragStart={(event, cueId) => { event.dataTransfer.effectAllowed = "move"; onDrag({ id: cueId, kind: "cue" }); }} onDropCue={dragged?.kind === "cue" ? dropAtCue : undefined} onPreviewDrop={(cueId, side) => { if (dragged?.kind === "cue") onDropTarget(cueId !== dragged.id ? { id: cueId, kind: "cue", side } : null); }} />)}<div className="relative h-full">{dropTarget?.kind === "cue" && dropTarget.id === `end-${group.id}` ? <div aria-label="Insert cue at end of group" aria-orientation="vertical" role="separator" className="absolute -left-1.5 bottom-1 top-1 w-0.5 bg-canvas-ink" data-testid="cue-drop-preview" /> : null}<button aria-label={`Add cue to ${group.label}`} className="flex h-full min-h-12 w-full items-center justify-center rounded-lg border border-dashed border-canvas-line text-canvas-muted transition hover:bg-canvas" onClick={() => onAddCue(placement)} onDragOver={(event) => { if (dragged?.kind === "cue") { event.preventDefault(); onDropTarget({ id: `end-${group.id}`, kind: "cue" }); } }} type="button"><Plus aria-hidden="true" className="h-6 w-6" /></button></div></div> : null}
    </article>
  </motion.div>;
}
