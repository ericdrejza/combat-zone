import { useLayoutEffect, useRef, useState } from "react";
import type { EncounterPanelId, EncounterPanelState } from "@core/encounter/panelLayout";

type Selection = { encounterId: string; panelId: EncounterPanelId | null };

/** Pin active IDs through reordering; a removed tab hands its slot to its next neighbor. */
export function usePanelTabSelection(encounterId: string, panels: EncounterPanelState[], enabled: boolean, libraryAvailable: boolean) {
  const [selection, setSelection] = useState<Selection>({ encounterId, panelId: null });
  const previous = useRef<{ encounterId: string; ids: EncounterPanelId[] }>({ encounterId, ids: [] });
  const available = panels.filter(panel => panel.id !== "library" || libraryAvailable);
  const selected = selection.encounterId === encounterId ? selection.panelId : null;
  let active = available.find(panel => panel.id === selected);
  if (!active && selected && previous.current.encounterId === encounterId) {
    const index = previous.current.ids.indexOf(selected);
    const neighbors = [...previous.current.ids.slice(index + 1), ...previous.current.ids.slice(0, index).reverse()];
    const next = neighbors.find(id => available.some(panel => panel.id === id));
    active = available.find(panel => panel.id === next);
  }
  active ??= available.find(panel => !panel.collapsed) ?? available[0];
  const activeId = active?.id ?? null;
  const order = available.map(panel => panel.id).join(",");
  useLayoutEffect(() => {
    const panelId = enabled ? activeId : null;
    setSelection(current => current.encounterId === encounterId && current.panelId === panelId
      ? current : { encounterId, panelId });
    previous.current = { encounterId, ids: enabled ? available.map(panel => panel.id) : [] };
  }, [encounterId, enabled, activeId, order]);
  return {
    activePanelId: activeId,
    selectPanel: (panelId: EncounterPanelId) => setSelection({ encounterId, panelId })
  };
}
