import type { EncounterState } from "@core/encounter/types";
import type { AudioCueGroup } from "@entities/audio/types";

type MemberLabel = { label: string; count: number };

/** Counts entities rather than distinct names so condensed totals remain accurate. */
export function groupMemberNames(names: string[]): MemberLabel[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ label: count > 1 ? `${name} x${count}` : name, count }));
}

export function getAudioGroupMemberSummary(state: EncounterState, group: AudioCueGroup) {
  const all = group.section === "actor" ? state.actors.allIds.map((id) => state.actors.byId[id])
    : group.section === "zone" ? state.zones.allIds.map((id) => state.zones.byId[id]) : [];
  const members = all.filter((entity) => entity.audioGroupIds?.includes(group.id));
  const names = groupMemberNames(members.map((entity) => entity.name));
  let labels = names;
  if (members.length && members.length === all.length) labels = [{ label: "All", count: members.length }];
  const others = members.length - (labels[0]?.count ?? 0);
  return {
    count: members.length,
    full: labels.map((item) => item.label).join(", "),
    condensed: others ? `${labels[0].label} and ${others} ${others === 1 ? "other" : "others"}` : labels[0]?.label ?? "",
    countOnly: `${members.length} ${members.length === 1 ? "member" : "members"}`,
    names: names.map((item) => item.label)
  };
}

export function chooseMemberSummary(width: number, fullWidth: number, condensedWidth: number): "full" | "condensed" | "countOnly" {
  if (!width || fullWidth <= width) return "full";
  return condensedWidth <= width ? "condensed" : "countOnly";
}
