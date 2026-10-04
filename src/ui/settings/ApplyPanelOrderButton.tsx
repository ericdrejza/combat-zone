import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { EncounterPanelOrder } from "@core/encounter/panelLayout";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { commitEncounterChange } from "@store/encounterSlice";
import type { AppDispatch, RootState } from "@store/store";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";

/** Applies only dock sides and order, preserving each panel's collapsed state. */
export function ApplyPanelOrderButton({ order }: { order: EncounterPanelOrder }) {
  const dispatch = useDispatch<AppDispatch>();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const { readOnly } = useContext(PersistenceContext);

  function applyOrder() {
    if (readOnly) return;
    const panels = [...encounter.panelLayout.left, ...encounter.panelLayout.right];
    const panelById = new Map(panels.map((panel) => [panel.id, panel]));
    const panelLayout = {
      left: order.left.map((id) => panelById.get(id)!),
      right: order.right.map((id) => panelById.get(id)!)
    };
    if ((["left", "right"] as const).every((side) =>
      panelLayout[side].every((panel, index) => panel.id === encounter.panelLayout[side][index]?.id) &&
      panelLayout[side].length === encounter.panelLayout[side].length
    )) return;

    dispatch(commitEncounterChange({
      action: {
        ...createEncounterActionRecord("interface.applyPanelOrder", {
          left: order.left,
          right: order.right
        }),
        validationResult: undefined
      },
      nextEncounter: { ...encounter, panelLayout }
    }));
  }

  return <button
    className="mt-3 rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm font-medium hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
    disabled={readOnly}
    onClick={applyOrder}
    type="button"
  >Apply to current encounter</button>;
}
