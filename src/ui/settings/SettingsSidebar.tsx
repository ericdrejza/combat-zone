import {
  Swords,
  Database,
  Grid3X3,
  Headphones,
  Keyboard,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { motion } from "motion/react";

import type { SettingsTabId } from "./settingsTabs";

type Tab = { id: SettingsTabId; icon: LucideIcon; label: string };

const workspaceTabs: Tab[] = [
  { id: "audio", icon: Headphones, label: "Audio" },
  { id: "canvas", icon: Grid3X3, label: "Canvas" },
  { id: "combat", icon: Swords, label: "Combat" },
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
  tab,
  tabIdPrefix,
  panelId
}: {
  activeTab: SettingsTabId;
  expanded: boolean;
  onSelect: (tab: SettingsTabId) => void;
  tab: Tab;
  tabIdPrefix?: string;
  panelId?: string;
}) {
  const Icon = tab.icon;
  const selected = activeTab === tab.id;
  return (
    <TouchTooltip label={tab.label}><button
      id={tabIdPrefix ? `${tabIdPrefix}-${tab.id}` : undefined}
      aria-controls={panelId}
      aria-selected={selected}
      aria-label={tab.label}
      title={tab.label}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${selected ? "bg-canvas-ink text-canvas-on-ink hover:ring-2 hover:ring-inset hover:ring-canvas-muted" : "text-canvas-muted hover:bg-canvas-surface hover:text-canvas-ink"}`}
      onClick={() => onSelect(tab.id)}
      role="tab"
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {expanded ? <span className="whitespace-nowrap">{tab.label}</span> : null}
    </button></TouchTooltip>
  );
}

export function SettingsSidebar({
  activeTab,
  compact,
  expanded,
  onSelect,
  onToggle,
  tabIdPrefix,
  panelId
}: {
  activeTab: SettingsTabId;
  compact: boolean;
  expanded: boolean;
  onSelect: (tab: SettingsTabId) => void;
  onToggle: () => void;
  tabIdPrefix?: string;
  panelId?: string;
}) {
  const showLabels = !compact || expanded;

  return (
    <motion.aside
      animate={{ width: showLabels ? 176 : 64 }}
      aria-label="Settings sections"
      className="flex shrink-0 flex-col overflow-hidden [&_span[data-touch-tooltip-label]]:w-full border-r border-canvas-line bg-canvas p-3"
      initial={false}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {compact ? (
        <TouchTooltip label={expanded ? "Collapse settings navigation" : "Expand settings navigation"}><button
          aria-label={
            expanded
              ? "Collapse settings navigation"
              : "Expand settings navigation"
          }
          title={expanded ? "Collapse settings navigation" : "Expand settings navigation"}
          aria-expanded={expanded}
          className="mb-3 flex h-9 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-canvas-muted transition hover:bg-canvas-surface hover:text-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
          onClick={onToggle}
          type="button"
        >
          {expanded ? (
            <PanelLeftClose aria-hidden="true" className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftOpen aria-hidden="true" className="h-4 w-4 shrink-0" />
          )}
          {expanded ? <span className="whitespace-nowrap">Collapse</span> : null}
        </button></TouchTooltip>
      ) : null}
      <div>
        {showLabels ? (
          <h3 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">
            Workspace
          </h3>
        ) : null}
        <div aria-label="Workspace settings" className="space-y-1" role="tablist">
          {workspaceTabs.map((tab) => (
            <TabButton
              activeTab={activeTab}
              expanded={showLabels}
              key={tab.id}
              onSelect={onSelect}
              tab={tab}
              tabIdPrefix={tabIdPrefix}
              panelId={panelId}
            />
          ))}
        </div>
      </div>
      <div className="mt-auto border-t border-canvas-line pt-3">
        {showLabels ? (
          <h3 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">
            Account &amp; data
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
              tabIdPrefix={tabIdPrefix}
              panelId={panelId}
            />
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
