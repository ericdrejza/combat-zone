import {
  Database,
  Headphones,
  Keyboard,
  Monitor,
  UserRound,
  type LucideIcon
} from "lucide-react";

import type { SettingsTabId } from "./settingsTabs";

type Tab = { id: SettingsTabId; icon: LucideIcon; label: string };

const generalTabs: Tab[] = [
  { id: "audio", icon: Headphones, label: "Audio" },
  { id: "interface", icon: Monitor, label: "Interface" },
  { id: "keybinds", icon: Keyboard, label: "Keybinds" }
];

const accountTabs: Tab[] = [
  { id: "account", icon: UserRound, label: "Account" },
  { id: "data", icon: Database, label: "Data" }
];

function TabButton({ activeTab, onSelect, tab }: {
  activeTab: SettingsTabId;
  onSelect: (tab: SettingsTabId) => void;
  tab: Tab;
}) {
  const Icon = tab.icon;
  const selected = activeTab === tab.id;
  return (
    <button
      aria-selected={selected}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${selected ? "bg-canvas-ink text-canvas-on-ink" : "text-canvas-muted hover:bg-canvas-surface hover:text-canvas-ink"}`}
      onClick={() => onSelect(tab.id)}
      role="tab"
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {tab.label}
    </button>
  );
}

export function SettingsSidebar({ activeTab, onSelect }: {
  activeTab: SettingsTabId;
  onSelect: (tab: SettingsTabId) => void;
}) {
  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-canvas-line bg-canvas p-3" aria-label="Settings sections">
      <div>
        <h3 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">General</h3>
        <div aria-label="General settings" className="space-y-1" role="tablist">
          {generalTabs.map((tab) => <TabButton activeTab={activeTab} key={tab.id} onSelect={onSelect} tab={tab} />)}
        </div>
      </div>
      <div className="mt-auto border-t border-canvas-line pt-3">
        <h3 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">Account</h3>
        <div aria-label="Account settings" className="space-y-1" role="tablist">
          {accountTabs.map((tab) => <TabButton activeTab={activeTab} key={tab.id} onSelect={onSelect} tab={tab} />)}
        </div>
      </div>
    </aside>
  );
}
