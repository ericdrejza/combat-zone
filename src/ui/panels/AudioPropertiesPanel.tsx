import { MoveDown, MoveUp } from "lucide-react";
import { motion } from "motion/react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { setEntityAudioGroups } from "@entities/audio/audioMutations";
import { getAudioGroupsBySection } from "@entities/audio/audioSelectors";
import { commitEncounterChange } from "@store/encounterSlice";
import type { RootState } from "@store/store";
import { SoundboardLauncherButton } from "@ui/audio/SoundboardLauncherButton";

export function AudioPropertiesPanel() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const { audioTool, selection } = useSelector((state: RootState) => state.interaction);
  if (audioTool.sectionType === "encounter") return <div className="flex items-start gap-2"><p className="flex-1 text-sm text-canvas-muted">Manage Encounter Ambience and Music groups in the Soundboard.</p><SoundboardLauncherButton /></div>;
  if (selection.selectedEntityType !== audioTool.sectionType || selection.selectedIds.length !== 1) {
    return <div className="flex items-start gap-2"><p className="flex-1 text-sm text-canvas-muted">Select exactly one {audioTool.sectionType} to assign reusable audio groups.</p><SoundboardLauncherButton /></div>;
  }
  const entityId = selection.selectedIds[0];
  const entity = audioTool.sectionType === "zone" ? encounter.zones.byId[entityId] : encounter.actors.byId[entityId];
  const groups = getAudioGroupsBySection(encounter, audioTool.sectionType);
  const assignedIds = entity?.audioGroupIds ?? [];
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const orderedGroups = [...assignedIds.map((id) => groupsById.get(id)).filter(Boolean), ...groups.filter((group) => !assignedIds.includes(group.id))];
  function commitGroups(groupIds: string[], actionType: string, groupId: string) {
    dispatch(commitEncounterChange({ action: createEncounterActionRecord(actionType, { entityId, groupId }), nextEncounter: setEntityAudioGroups(encounter, audioTool.sectionType as "zone" | "actor", entityId, groupIds) }));
  }
  function move(groupId: string, offset: number) {
    const index = assignedIds.indexOf(groupId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= assignedIds.length) return;
    const next = [...assignedIds];
    [next[index], next[target]] = [next[target], next[index]];
    commitGroups(next, "audio.reorderGroups", groupId);
  }
  return <div className="space-y-3"><div className="flex items-center justify-between gap-2"><h3 className="font-display text-base font-semibold">{entity?.name ?? `Selected ${audioTool.sectionType}`}</h3><SoundboardLauncherButton target={entity ? { entityId, entityType: audioTool.sectionType } : undefined} /></div><fieldset className="space-y-2"><legend className="text-sm font-semibold">Assigned {audioTool.sectionType} groups</legend>{orderedGroups.map((group) => {
    if (!group) return null;
    const checked = assignedIds.includes(group.id);
    const assignedIndex = assignedIds.indexOf(group.id);
    return <motion.div className="flex items-center gap-2 rounded-xl border border-canvas-line p-3 text-sm" key={group.id} layout="position"><label className="flex min-w-0 flex-1 items-center gap-2"><input checked={checked} onChange={() => {
      const groupIds = checked ? assignedIds.filter((id) => id !== group.id) : [...assignedIds, group.id];
      commitGroups(groupIds, "audio.assignGroup", group.id);
    }} type="checkbox" /><span className="truncate">{group.name}</span></label>{checked ? <span className="flex gap-1"><button aria-label={`Move ${group.name} up`} className="text-canvas-muted enabled:hover:text-canvas-ink disabled:cursor-default disabled:opacity-30" disabled={assignedIndex === 0} onClick={() => move(group.id, -1)} type="button"><MoveUp aria-hidden="true" className="h-4 w-4" /></button><button aria-label={`Move ${group.name} down`} className="text-canvas-muted enabled:hover:text-canvas-ink disabled:cursor-default disabled:opacity-30" disabled={assignedIndex === assignedIds.length - 1} onClick={() => move(group.id, 1)} type="button"><MoveDown aria-hidden="true" className="h-4 w-4" /></button></span> : null}</motion.div>;
  })}{groups.length === 0 ? <p className="text-sm text-canvas-muted">Create a group in the Soundboard first.</p> : null}</fieldset></div>;
}
