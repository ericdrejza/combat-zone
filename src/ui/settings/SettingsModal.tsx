import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { SettingsCategory } from "./SettingsLayout";
import { CanvasSettings } from './CanvasSettings';
import { CombatSettings } from "./CombatSettings";
import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { useCompactLayout } from "@hooks/useCompactLayout";
import { CloudSyncSettings } from "@ui/cloud_sync";
import { DataSettings } from "./DataSettings";
import { InterfaceSettings } from "./InterfaceSettings";
import { KeybindSettings } from "./KeybindSettings";
import { SettingsSidebar } from "./SettingsSidebar";
import type { SettingsTabId } from "./settingsTabs";
import { createSettingsSession, type SettingsSession } from "./settingsSession";
import { AudioSettings } from "./AudioSettings";

type SettingsModalProps = {
  session?: SettingsSession;
  onClose: () => void;
  onExportWorkspace: () => void;
  onResetLocalData: () => Promise<void> | void;
  onImportWorkspaceFile: (file: File) => Promise<void> | void;
  readOnly: boolean;
};

export function SettingsModal(props: SettingsModalProps) {
  const compact = useCompactLayout();
  const tabIdPrefix = useId();
  const panelId = `${tabIdPrefix}-panel`;
  const fallbackSession = useRef<SettingsSession>(createSettingsSession());
  const session = props.session ?? fallbackSession.current;
  const contentRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabId>(session.activeTab);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => !compact);

  useEffect(() => {
    setSidebarExpanded(!compact);
  }, [compact]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.scrollTop = session.scrollByTab[activeTab] ?? 0;
  }, [activeTab, session]);

  function rememberScroll() {
    if (contentRef.current) session.scrollByTab[activeTab] = contentRef.current.scrollTop;
  }

  function closeSettings() {
    rememberScroll();
    props.onClose();
  }

  function selectTab(tab: SettingsTabId) {
    rememberScroll();
    session.activeTab = tab;
    setActiveTab(tab);
    if (compact) setSidebarExpanded(false);
  }

  function renderTab() {
    if (activeTab === "account") return (
      <SettingsCategory title="Account" description="Account connections, cloud storage, and synchronization.">
        <CloudSyncSettings />
      </SettingsCategory>
    );
    if (activeTab === "canvas") return <CanvasSettings />;
    if (activeTab === "combat") return <CombatSettings />;
    if (activeTab === "audio") return <AudioSettings />;
    if (activeTab === "data") return <DataSettings {...props} onClose={closeSettings} />;
    if (activeTab === "interface") return <InterfaceSettings />;
    if (activeTab === "keybinds") return <KeybindSettings />;
    return (
      <section className="p-5" aria-labelledby={`settings-${activeTab}-heading`}>
        <h3 className="font-display text-lg font-semibold capitalize" id={`settings-${activeTab}-heading`}>{activeTab}</h3>
        <p className="mt-1 text-sm text-canvas-muted">Audio preferences will appear here.</p>
      </section>
    );
  }

  return (
    <div aria-label="Settings" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-2 sm:p-6" role="dialog">
      <div className="flex h-[min(42rem,90vh)] w-[min(56rem,94vw)] flex-col overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-canvas-line px-5 py-4">
          <h2 className="font-display text-xl font-semibold">Settings</h2>
          <TouchTooltip label="Close settings"><button aria-label="Close settings" className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink" onClick={closeSettings} title="Close settings" type="button"><X aria-hidden="true" className="h-4 w-4" /></button></TouchTooltip>
        </header>
        <div className="flex min-h-0 flex-1">
          <SettingsSidebar
            activeTab={activeTab}
            tabIdPrefix={tabIdPrefix}
            panelId={panelId}
            compact={compact}
            expanded={sidebarExpanded}
            onSelect={selectTab}
            onToggle={() => setSidebarExpanded((expanded) => !expanded)}
          />
          <main ref={contentRef} onScroll={(event) => { session.scrollByTab[activeTab] = event.currentTarget.scrollTop; }} id={panelId} aria-labelledby={`${tabIdPrefix}-${activeTab}`} className="min-w-0 flex-1 overflow-y-auto" role="tabpanel">{renderTab()}</main>
        </div>
      </div>
    </div>
  );
}
