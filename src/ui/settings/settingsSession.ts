import type { SettingsTabId } from "./settingsTabs";

/** In-memory navigation state owned by the application session, never persisted. */
export type SettingsSession = {
  activeTab: SettingsTabId;
  scrollByTab: Partial<Record<SettingsTabId, number>>;
};

export function createSettingsSession(): SettingsSession {
  return { activeTab: "audio", scrollByTab: {} };
}

