import { EncounterStatusPanel } from "./status_panel/EncounterStatusPanel";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { ActorStatusPanel } from "./status_panel/ActorStatusPanel";
import { ZoneStatusPanel } from "./status_panel/ZoneStatusPanel";

/** Route selection to focused entity status controls in every panel layout. */
export function StatusPanel() {
  const { selectedEntityType: type, selectedIds } = useSelector((state: RootState) => state.interaction.selection);
  if (!selectedIds.length) return <EncounterStatusPanel />;
  if (type === "zone") return <ZoneStatusPanel />;
  if (type === "actor") return <ActorStatusPanel />;
  return <p className="p-4 text-sm text-canvas-muted">Select an actor or one zone to view status.</p>;
}
