import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { useCompactLayout } from "@hooks/useCompactLayout";
import { CloudSyncSettings } from "@ui/cloud_sync";
import { DataSettings } from "./DataSettings";
import { InterfaceSettings } from "./InterfaceSettings";
import { KeybindSettings } from "./KeybindSettings";
import { SettingsSidebar } from "./SettingsSidebar";
import type { SettingsTabId } from "./settingsTabs";

type SettingsModalProps = {
  onClose: () => void;
  onExportWorkspace: () => void;
  onResetLocalData: () => Promise<void> | void;
  onImportWorkspaceFile: (file: File) => Promise<void> | void;
  readOnly: boolean;
};

export function SettingsModal(props: SettingsModalProps) {
  const compact = useCompactLayout();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("audio");
  const [sidebarExpanded, setSidebarExpanded] = useState(() => !compact);

  useEffect(() => {
    setSidebarExpanded(!compact);
  }, [compact]);

  function selectTab(tab: SettingsTabId) {
    setActiveTab(tab);
    if (compact) setSidebarExpanded(false);
  }

  function renderTab() {
    if (activeTab === "account") return (
      <section aria-labelledby="settings-account-heading">
        <h3 className="px-5 pt-5 font-display text-lg font-semibold" id="settings-account-heading">Account</h3>
        <CloudSyncSettings />
      </section>
    );
    if (activeTab === "data") return <DataSettings {...props} />;
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
          <button aria-label="Close settings" className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted transition hover:bg-canvas" onClick={props.onClose} type="button"><X aria-hidden="true" className="h-4 w-4" /></button>
        </header>
        <div className="flex min-h-0 flex-1">
          <SettingsSidebar
            activeTab={activeTab}
            compact={compact}
            expanded={sidebarExpanded}
            onSelect={selectTab}
            onToggle={() => setSidebarExpanded((expanded) => !expanded)}
          />
          <main className="min-w-0 flex-1 overflow-y-auto" role="tabpanel">{renderTab()}</main>
        </div>
      </div>
    </div>
  );
}
