import type { ReactNode } from "react";
import type { EncounterPanelId, EncounterPanelState } from "@core/encounter/panelLayout";
import { getDockablePanelDefinition } from "./dockablePanelMetadata";
import type { DockPanelDefinition } from "./PanelsShell";

type Props = {
  panels: EncounterPanelState[];
  activePanelId: EncounterPanelId | null;
  renderPanelHeaderActions?: (panel: DockPanelDefinition) => ReactNode;
  renderPanelContent?: (panel: DockPanelDefinition) => ReactNode;
};

/** Keep inactive panel drafts mounted, while exposing only the active tab's content. */
export function TabbedPanels({ panels, activePanelId, renderPanelContent, renderPanelHeaderActions }: Props) {
  return <div className="flex min-h-0 w-72 flex-1 flex-col">
    {panels.map(panel => {
      const definition = { ...panel, ...getDockablePanelDefinition(panel.id) };
      const active = panel.id === activePanelId;
      return <section key={panel.id} role="tabpanel" id={`panel-tab-content-${panel.id}`}
        aria-labelledby={`panel-tab-${panel.id}`} hidden={!active}
        data-drop-target={panel.id === "zoneless" ? "zoneless-actors" : undefined}
        className={active ? "flex min-h-0 flex-1 flex-col rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm" : "hidden"}>
        <header className="flex shrink-0 items-center justify-between gap-2 p-4">
          <h2 className="font-display text-lg font-semibold">{definition.title}</h2>
          <div className="flex items-center gap-2">{renderPanelHeaderActions?.(definition)}</div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-canvas-line px-4 pb-4 pt-3">
          {renderPanelContent?.(definition)}
        </div>
      </section>;
    })}
  </div>;
}
