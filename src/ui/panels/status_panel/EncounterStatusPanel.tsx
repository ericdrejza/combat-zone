import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { StatusResourceControls } from "./StatusResourceControls";

/** No selection exposes resources owned by the encounter, independent of Zones. */
export function EncounterStatusPanel() {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const { readOnly } = usePersistence();
  const commit = useStatusActions();
  return <div aria-label="Encounter status" className="space-y-4 py-2">
    <p aria-label="Encounter name" className="break-words font-semibold">{encounter.name}</p>
    <StatusResourceControls key={encounter.id} owner={encounter} disabled={readOnly} onChange={(type, payload, mutate) => { void commit(`encounter.${type}`, payload, mutate); }} />
  </div>;
}
