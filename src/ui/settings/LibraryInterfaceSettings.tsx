import type { LibrarySectionId } from "@library/types";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LIBRARY_GRID_CARD_MAX, LIBRARY_GRID_CARD_MIN, type LibraryViewDefault } from "@ui/interface_preferences/libraryPreferences";
import { PreferenceSwitch } from "./PreferenceSwitch";

const CARD_TYPES: Array<{ id: LibrarySectionId; label: string }> = [
  { id: "encounters", label: "Encounter" }, { id: "backgrounds", label: "Background" },
  { id: "tokens", label: "Token" }, { id: "audio", label: "Audio" }
];

export function LibraryInterfaceSettings() {
  const preferences = useInterfacePreferences();
  return <fieldset className="max-w-lg border-t border-canvas-line pt-5">
    <legend className="pr-3 text-sm font-semibold">Library</legend>
    <div className="divide-y divide-canvas-line">
      <PreferenceSwitch label="Close Library modal when clicking outside" checked={preferences.libraryCloseOnOutsideClick} onChange={preferences.setLibraryCloseOnOutsideClick} />
      <ViewDefault label="Default Library modal view" value={preferences.libraryModalViewDefault} onChange={preferences.setLibraryModalViewDefault} />
      <ViewDefault label="Default Library panel view" value={preferences.libraryPanelViewDefault} onChange={preferences.setLibraryPanelViewDefault} />
      <PreferenceSwitch label="Independent Library grid card sizes" checked={preferences.libraryIndependentGridCardSizes} onChange={preferences.setLibraryIndependentGridCardSizes} />
      {preferences.libraryIndependentGridCardSizes
        ? CARD_TYPES.map(({ id, label }) => <CardSize key={id} label={`${label} grid card size`} value={preferences.libraryGridCardSizes[id]} onChange={(size) => preferences.setLibrarySectionGridCardSize(id, size)} />)
        : <CardSize label="Library grid card size" value={preferences.libraryGridCardSize} onChange={preferences.setLibraryGridCardSize} />}
      <p className="py-3 text-xs text-canvas-muted">Minimum card width in grid view. Cards fit the available space in the modal and panel.</p>
    </div>
  </fieldset>;
}

function ViewDefault({ label, value, onChange }: { label: string; value: LibraryViewDefault; onChange: (view: LibraryViewDefault) => void }) {
  return <label className="flex min-h-12 flex-wrap items-center justify-between gap-3 py-3 text-sm">
    <span>{label}</span>
    <select aria-label={label} className="rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink" value={value} onChange={(event) => onChange(event.currentTarget.value as LibraryViewDefault)}>
      <option value="grid">Grid</option><option value="list">List</option>
    </select>
  </label>;
}

function CardSize({ label, value, onChange }: { label: string; value: number; onChange: (size: number) => void }) {
  return <label className="block space-y-2 py-3 text-sm">
    <span className="flex flex-wrap items-center justify-between gap-2"><span>{label}</span><span className="tabular-nums text-canvas-muted">{value}px</span></span>
    <input aria-label={label} className="w-full cursor-pointer accent-canvas-ink focus-visible:rounded focus-visible:ring-2 focus-visible:ring-canvas-ink" type="range" min={LIBRARY_GRID_CARD_MIN} max={LIBRARY_GRID_CARD_MAX} step="1" value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} />
  </label>;
}
