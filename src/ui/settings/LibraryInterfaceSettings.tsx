import type { LibrarySectionId } from "@library/types";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LIBRARY_CARD_SIZE_STEPS, type LibraryViewDefault, type LibraryPanelViewMode } from "@ui/interface_preferences/libraryPreferences";
import { SettingsSection, SettingsSubsection, SettingsField, SETTINGS_CONTROL, SETTINGS_SLIDER } from "./SettingsLayout";
import { PreferenceSwitch } from "./PreferenceSwitch";

const CARD_TYPES: Array<{ id: LibrarySectionId; label: string }> = [
  { id: "audio", label: "Audio" },
  { id: "backgrounds", label: "Background" },
  { id: "tokens", label: "Character and Token" },
  { id: "encounters", label: "Encounter" }
];

export function LibraryInterfaceSettings() {
  const preferences = useInterfacePreferences();
  return <SettingsSection title="Library">
    <SettingsSubsection title="Behavior and views">
      <PreferenceSwitch label="Close Library modal when clicking outside" checked={preferences.libraryCloseOnOutsideClick} onChange={preferences.setLibraryCloseOnOutsideClick} />
      <ViewDefault label="Default Library modal view" value={preferences.libraryModalViewDefault} onChange={preferences.setLibraryModalViewDefault} />
      <PanelViewDefault value={preferences.libraryPanelViewDefault} onChange={preferences.setLibraryPanelViewDefault} />
    </SettingsSubsection>
    <SettingsSubsection title="Card sizes" description="Card size in the Library modal grid. Smaller cards fit more assets across the available screen width. Characters and Tokens share a size; the Library panel uses its own view choice.">
      <PreferenceSwitch label="Independent Library card sizes" checked={preferences.libraryIndependentGridCardSizes} onChange={preferences.setLibraryIndependentGridCardSizes} />
      {preferences.libraryIndependentGridCardSizes
        ? CARD_TYPES.map(({ id, label }) => <CardSize key={id} label={`${label} card size`} value={preferences.libraryGridCardSizes[id]} onChange={(size) => preferences.setLibrarySectionGridCardSize(id, size)} />)
        : <CardSize label="Library card size" value={preferences.libraryGridCardSize} onChange={preferences.setLibraryGridCardSize} />}
    </SettingsSubsection>
  </SettingsSection>;
}

function ViewDefault({ label, value, onChange }: { label: string; value: LibraryViewDefault; onChange: (view: LibraryViewDefault) => void }) {
  return <SettingsField label={label}>
    <select aria-label={label} className={SETTINGS_CONTROL} value={value} onChange={(event) => onChange(event.currentTarget.value as LibraryViewDefault)}>
      <option value="grid">Grid</option><option value="list">List</option>
    </select>
  </SettingsField>;
}

function PanelViewDefault({ value, onChange }: { value: LibraryPanelViewMode; onChange: (view: LibraryPanelViewMode) => void }) {
  return <SettingsField label="Default Library panel view">
    <select aria-label="Default Library panel view" className={SETTINGS_CONTROL} value={value} onChange={(event) => onChange(event.currentTarget.value as LibraryPanelViewMode)}>
      <option value="list">List</option><option value="one-column">One column</option><option value="two-column">Two columns</option>
    </select>
  </SettingsField>;
}

function CardSize({ label, value, onChange }: { label: string; value: number; onChange: (size: number) => void }) {
  const index = LIBRARY_CARD_SIZE_STEPS.findIndex((step) => step.width === value);
  const selected = LIBRARY_CARD_SIZE_STEPS[index];
  return <SettingsField label={label} fullWidth valueLabel={selected.label}>
    <input aria-label={label} className={SETTINGS_SLIDER} type="range" min={0} max={LIBRARY_CARD_SIZE_STEPS.length - 1} step="1" value={index} aria-valuetext={selected.label} onChange={(event) => onChange(LIBRARY_CARD_SIZE_STEPS[Number(event.currentTarget.value)].width)} />
  </SettingsField>;
}
