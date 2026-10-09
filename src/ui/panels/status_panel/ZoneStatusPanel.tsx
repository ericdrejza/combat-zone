import { applyTagChanges } from "@core/entity_resources/tags";
import { useSelector } from "react-redux";
import type { Zone } from "@entities/zone/types";
import { updateZoneStatus } from "@entities/zone/zoneStatus";
import type { RootState } from "@store/store";
import { NotesEditor } from "@ui/controls/NotesEditor";
import { TagEditor } from "@ui/controls/TagEditor";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { StatusResourceControls } from "./StatusResourceControls";

export function ZoneStatusPanel() {
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const zones = useSelector((state: RootState) => state.encounter.present.zones);
  const ids = [...new Set(selection.selectedIds)];
  const zone = ids.length === 1 ? zones.byId[ids[0]] : undefined;
  const { readOnly } = usePersistence();
  const commit = useStatusActions();
  if (!zone) return <p className="p-4 text-sm text-canvas-muted">Select one zone to view status.</p>;
  function change(type: string, payload: Parameters<typeof commit>[1], mutate: (zone: Zone) => Zone) {
    void commit(`zone.${type}`, { zoneId: zone!.id, ...payload }, (state) => updateZoneStatus(state, zone!.id, mutate));
  }
  return <div aria-label="Zone status" className="space-y-4 py-2">
    <p aria-label="Selected zone name" className="break-words font-semibold">{zone.name}</p>
    <StatusResourceControls key={zone.id} owner={zone} disabled={readOnly} onChange={change} />
    <div className="border-t border-canvas-line pt-3">
      <TagEditor key={`tags:${zone.id}`} tags={zone.tags} disabled={readOnly} inputLabel="Add zone tag" tagsLabel="Zone tags" onChange={(tags) => change("setTags", { tags }, (current) => { const next = applyTagChanges(current.tags, zone.tags, tags); return next === current.tags ? current : { ...current, tags: next }; })} />
    </div>
    <NotesEditor key={`notes:${zone.id}`} notes={zone.notes} disabled={readOnly} onChange={(notes) => change("setNotes", { notes }, (current) => (current.notes ?? "") === notes ? current : { ...current, notes })} />
  </div>;
}
