import { type ComponentProps, type ReactNode } from "react";
import type { EncounterPanelId } from "@core/encounter/panelLayout";
import { PanelsShell } from "./PanelsShell";
import { PanelFooterTabs } from "./PanelFooterTabs";
import { SidebarDock } from "./SidebarDock";
import { usePanelReorderAutoScroll } from "./usePanelReorderAutoScroll";
import { usePanelTabSelection } from "./usePanelTabSelection";
import { TabbedPanels } from "./TabbedPanels";

type Props = ComponentProps<typeof PanelsShell> & {
  collapsed: boolean;
  encounterId: string;
  footerActions?: ReactNode;
  footerEnd?: ReactNode;
  headerActions?: ReactNode;
  onToggle: () => void;
  tabMode: boolean;
  libraryAvailable: boolean;
};

/** Owns session-only tab selection; dock side/order continue to belong to the encounter. */
export function WorkspaceSidebar({ collapsed, encounterId, footerActions, footerEnd, headerActions,
  onToggle, tabMode, libraryAvailable, ...panelsProps }: Props) {
  const { panels, side, ...dragProps } = panelsProps;
  const footerScrollRef = usePanelReorderAutoScroll(tabMode && panelsProps.draggedPanelId !== null,
    panelsProps.onPreviewDrop, collapsed ? "vertical" : "horizontal");
  const { activePanelId, selectPanel: setPanel } = usePanelTabSelection(encounterId, panels, tabMode, libraryAvailable);
  function selectPanel(panelId: EncounterPanelId) {
    setPanel(panelId);
    if (collapsed || panelId === activePanelId) onToggle();
  }
  const stackedFooter = collapsed && side === "left";
  const footer = tabMode || footerActions || footerEnd ? (
    <div className={`flex min-h-0 gap-2 ${stackedFooter ? "flex-col" : "items-stretch justify-between"}`}>
      {footerActions && !stackedFooter ? <div className={tabMode ? "shrink-0 self-start py-1" : "shrink-0 self-end"}>{footerActions}</div> : null}
      {tabMode ? <div ref={footerScrollRef} className={`max-h-[40vh] min-h-0 min-w-10 flex-1 py-1 ${collapsed ? "overflow-y-auto overflow-x-hidden" : "overflow-x-auto overflow-y-hidden"}`}>
        <PanelFooterTabs {...dragProps} panels={panels} side={side}
          activePanelId={activePanelId} collapsed={collapsed}
          libraryAvailable={libraryAvailable} onSelect={selectPanel} />
      </div> : null}
      {stackedFooter ? <div className="flex shrink-0 flex-col items-center gap-2">
        {tabMode ? <div role="separator" aria-label="Panel tabs and sidebar controls" aria-orientation="horizontal"
          className="w-full border-t border-canvas-line" /> : null}
        {footerEnd}{footerActions}
      </div> : footerEnd ? <div className={tabMode ? "shrink-0 self-start py-1" : "shrink-0 self-end"}>{footerEnd}</div> : null}
    </div>
  ) : undefined;
  return <SidebarDock collapsed={collapsed} hideToggle={panels.length === 0}
    footer={footer} headerActions={headerActions} onToggle={onToggle} side={side}>
    {tabMode ? panels.length ? <TabbedPanels panels={panels} activePanelId={activePanelId}
      renderPanelContent={panelsProps.renderPanelContent}
      renderPanelHeaderActions={panelsProps.renderPanelHeaderActions} />
      : <div className="min-h-0 w-10 flex-1" />
      : <PanelsShell {...panelsProps} />}
  </SidebarDock>;
}
