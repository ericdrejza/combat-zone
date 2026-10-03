import type { EncounterState } from "@core/encounter/types";
import type { AudioCueGroupSection, AudioCuePlacement, AudioCueType, AudioSectionType } from "@entities/audio/types";
import type { LibraryNode, LibrarySection } from "@library/types";
import { getAudioDestinationSections } from "./audioDestinations";

type Props = {
  audioLibrary: LibrarySection;
  cueType: AudioCueType;
  encounter: EncounterState;
  node: LibraryNode;
  onCancel: () => void;
  onChoose: (placement: AudioCuePlacement) => void;
  onCreateGroup: (section: AudioCueGroupSection) => void;
  sectionType: AudioSectionType;
  selectedEntityId: string | null;
};

/** A destination remains explicit even when there is only one compatible group. */
export function AudioDestinationDialog({ audioLibrary, cueType, encounter, node, onCancel, onChoose, onCreateGroup, sectionType, selectedEntityId }: Props) {
  const sections = getAudioDestinationSections(sectionType, cueType);
  const groupIds = sectionType === "encounter" ? encounter.audioCueGroups.allIds
    : selectedEntityId ? sectionType === "zone" ? encounter.zones.byId[selectedEntityId]?.audioGroupIds ?? [] : encounter.actors.byId[selectedEntityId]?.audioGroupIds ?? [] : [];
  return <div className="viewport-overlay z-[80] flex items-center justify-center bg-black/40 p-4">
    <div aria-label="Choose audio destination" aria-modal="true" className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-canvas-panel p-5 shadow-xl" role="dialog">
      <h3 className="font-display text-lg font-semibold">Add {node.name}</h3>
      <p className="mt-1 text-sm text-canvas-muted">Choose where this cue is configured.</p>
      <div className="mt-4 space-y-4">{sections.map((section) => {
        const label = section === "ambiance" ? "Ambience" : section === "music" ? "Music" : section === "zone" ? "Zone" : "Actor";
        return <section aria-label={`${label} groups`} className="space-y-2" key={section}>
          {sectionType === "encounter" ? <h4 className="font-semibold">{label}</h4> : null}
          {groupIds.filter((id) => encounter.audioCueGroups.byId[id]?.section === section).map((id) => {
            const group = encounter.audioCueGroups.byId[id];
            const cueNames = encounter.audioCues.allIds.filter((cueId) => encounter.audioCues.byId[cueId].placement.groupId === id).map((cueId) => audioLibrary.nodesById[encounter.audioCues.byId[cueId].libraryNodeId]?.name ?? "Missing audio");
            return <button className="block w-full rounded-xl border border-canvas-line p-3 text-left hover:bg-canvas" key={id} onClick={() => onChoose({ type: "group", groupId: id })} type="button"><span className="font-semibold">{group.name}</span>{cueNames.length ? <span className="block text-xs text-canvas-muted">{cueNames.join(", ")}</span> : null}</button>;
          })}
          <button className="block w-full rounded-xl border border-dashed border-canvas-line p-3 text-left font-semibold hover:bg-canvas" onClick={() => onCreateGroup(section)} type="button">{sectionType === "encounter" ? `Create new ${label} group` : "Create new cue group"}</button>
        </section>;
      })}</div>
      <div className="mt-4 flex justify-end"><button onClick={onCancel} type="button">Cancel</button></div>
    </div>
  </div>;
}
