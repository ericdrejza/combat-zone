import {
  Database,
  Headphones,
  Keyboard,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { motion } from "motion/react";

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

function TabButton({
  activeTab,
  expanded,
  onSelect,
  tab
}: {
  activeTab: SettingsTabId;
  expanded: boolean;
  onSelect: (tab: SettingsTabId) => void;
  tab: Tab;
}) {
  const Icon = tab.icon;
  const selected = activeTab === tab.id;
  return (
    <button
      aria-selected={selected}
      aria-label={tab.label}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${selected ? "bg-canvas-ink text-canvas-on-ink" : "text-canvas-muted hover:bg-canvas-surface hover:text-canvas-ink"}`}
      onClick={() => onSelect(tab.id)}
      role="tab"
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {expanded ? <span className="whitespace-nowrap">{tab.label}</span> : null}
    </button>
  );
}

export function SettingsSidebar({
  activeTab,
  compact,
  expanded,
  onSelect,
  onToggle
}: {
  activeTab: SettingsTabId;
  compact: boolean;
  expanded: boolean;
  onSelect: (tab: SettingsTabId) => void;
  onToggle: () => void;
}) {
  const showLabels = !compact || expanded;

  return (
    <motion.aside
      animate={{ width: showLabels ? 176 : 64 }}
      aria-label="Settings sections"
      className="flex shrink-0 flex-col overflow-hidden border-r border-canvas-line bg-canvas p-3"
      initial={false}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {compact ? (
        <button
          aria-label={
            expanded
              ? "Collapse settings navigation"
              : "Expand settings navigation"
          }
          aria-expanded={expanded}
          className="mb-3 flex h-9 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-canvas-muted transition hover:bg-canvas-surface hover:text-canvas-ink"
          onClick={onToggle}
          type="button"
        >
          {expanded ? (
            <PanelLeftClose aria-hidden="true" className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftOpen aria-hidden="true" className="h-4 w-4 shrink-0" />
          )}
          {expanded ? <span className="whitespace-nowrap">Collapse</span> : null}
        </button>
      ) : null}
      <div>
        {showLabels ? (
          <h3 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">
            General
          </h3>
        ) : null}
        <div aria-label="General settings" className="space-y-1" role="tablist">
          {generalTabs.map((tab) => (
            <TabButton
              activeTab={activeTab}
              expanded={showLabels}
              key={tab.id}
              onSelect={onSelect}
              tab={tab}
            />
          ))}
        </div>
      </div>
      <div className="mt-auto border-t border-canvas-line pt-3">
        {showLabels ? (
          <h3 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">
            Account
          </h3>
        ) : null}
        <div aria-label="Account settings" className="space-y-1" role="tablist">
          {accountTabs.map((tab) => (
            <TabButton
              activeTab={activeTab}
              expanded={showLabels}
              key={tab.id}
              onSelect={onSelect}
              tab={tab}
            />
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
