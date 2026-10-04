import { useId, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { EncounterState } from "@core/encounter/types";
import { getGroupInheritorIds, getGroupInheritorNames } from "@entities/audio/audioSelectors";
import type { AudioCueGroup } from "@entities/audio/types";
import { selectEntity, setActiveTool, setAudioSectionType } from "@interaction/interactionState";
import { canToolSelectEntityType } from "@interaction/tools/toolRegistry";
import type { RootState } from "@store/store";
import { AudioGroupMemberTooltip } from "@ui/audio/AudioGroupMemberTooltip";
import { groupMemberNames } from "@ui/audio/audioGroupMembers";

/** Selecting members changes only session selection, never group membership or history. */
export function AudioGroupMemberBadge({ encounter, group }: { encounter: EncounterState; group: AudioCueGroup }) {
  const dispatch = useDispatch();
  const activeToolId = useSelector((state: RootState) => state.interaction.activeToolId);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const tooltipId = useId();
  if (group.section !== "actor" && group.section !== "zone") return null;
  const ids = getGroupInheritorIds(encounter, group);
  const names = groupMemberNames(getGroupInheritorNames(encounter, group)).map((item) => item.label);
  const showTooltip = hovered || focused;
  const entityType = group.section;
  function selectMembers() {
    if (!ids.length) return;
    if (activeToolId === "audio") dispatch(setAudioSectionType(entityType));
    else if (!canToolSelectEntityType(activeToolId, entityType)) dispatch(setActiveTool("select"));
    dispatch(selectEntity({ entityType, ids, userInitiated: true }));
  }
  return <span className="relative shrink-0" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <button aria-label={`Select all ${ids.length} ${entityType} members of ${group.name}`} aria-describedby={showTooltip ? tooltipId : undefined} className="rounded-full bg-canvas px-2 py-0.5 text-xs text-canvas-muted hover:text-canvas-ink disabled:cursor-default" disabled={!ids.length} onClick={selectMembers} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} type="button">{ids.length}</button>
    {showTooltip ? <AudioGroupMemberTooltip id={tooltipId} names={names} /> : null}
  </span>;
}
