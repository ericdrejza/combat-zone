import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { ChevronDown, ChevronRight, Paintbrush, Swords } from "lucide-react";
import { useId, useState } from "react";

import type { Zone } from "@entities/zone/types";
import { getZoneEngagementColor } from "@entities/zone/zoneColors";
import type { ZonePaintBrushState } from "@interaction/interactionState";
import { PreferenceSwitch } from "@ui/settings/PreferenceSwitch";
import { ColorPalette } from "./ColorPalette";
import { ZoneColorCopyButton } from './ZoneColorCopyButton';
import type { CommitZoneProperties } from "./types";
import { useZoneOpacityControl } from "./useZoneOpacityControl";

type ZoneColorSectionProps = {
  colorSectionOpen: boolean;
  onActivateZonePaintBrush: () => void;
  onCancelZoneOpacityPreview: () => void;
  onCommitZoneProperties: CommitZoneProperties;
  onPreviewZoneOpacity: (opacity: number) => void;
  onToggleColorSection: () => void;
  zone: Zone;
  zonePaintBrush: ZonePaintBrushState | null;
};

type ZoneColorTab = "border" | "engagements" | "fill";

const colorTabs: Array<{ id: ZoneColorTab; label: string }> = [
  { id: "fill", label: "Fill" },
  { id: "border", label: "Border" },
  { id: "engagements", label: "Engagements" }
];

export function ZoneColorSection({
  colorSectionOpen,
  onActivateZonePaintBrush,
  onCancelZoneOpacityPreview,
  onCommitZoneProperties,
  onPreviewZoneOpacity,
  onToggleColorSection,
  zone,
  zonePaintBrush
}: ZoneColorSectionProps) {
  const { readOnly } = usePersistence();
  const [activeTab, setActiveTab] = useState<ZoneColorTab>("fill");
  const tabPanelId = useId();
  const matchesBorder = zone.matchEngagementColorToBorder !== false;
  const palette = activeTab === "fill"
    ? { label: "Fill color", property: "colorFill" as const, value: zone.colorFill }
    : activeTab === "border"
      ? { label: "Border color", property: "colorBorder" as const, value: zone.colorBorder }
      : {
          label: "Engagements color",
          property: "colorEngagement" as const,
          value: getZoneEngagementColor(zone)
        };
  const opacityControl = useZoneOpacityControl({
    onCancelPreview: onCancelZoneOpacityPreview,
    onCommit: (opacity) => onCommitZoneProperties({ opacity }),
    onPreview: onPreviewZoneOpacity,
    opacity: zone.opacity,
    zoneId: zone.id
  });

  return (
    <section className="rounded-2xl border border-canvas-line bg-canvas-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          aria-expanded={colorSectionOpen}
          className="inline-flex items-center gap-2 rounded font-semibold text-canvas-ink hover:text-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
          onClick={onToggleColorSection}
          type="button"
        >
          {colorSectionOpen ? (
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          )}
          Color
        </button>
        <div className="flex items-center gap-2"><ZoneColorCopyButton /><button
          aria-pressed={zonePaintBrush?.sourceZoneId === zone.id}
          disabled={readOnly}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50 ${
            zonePaintBrush?.sourceZoneId === zone.id
              ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
              : "border-canvas-line text-canvas-ink enabled:hover:bg-canvas"
          }`}
          onClick={onActivateZonePaintBrush}
          title="Paint zone colors"
          type="button"
        >
          <Paintbrush aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Paint zone colors</span>
        </button></div>
      </div>
      {colorSectionOpen ? (
        <div className="mt-4 space-y-4">
          <div
            aria-label="Zone color properties"
            className="grid grid-cols-3 rounded-xl bg-canvas p-1"
            role="tablist"
          >
            {colorTabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  aria-label={tab.label}
                  aria-controls={tabPanelId}
                  aria-selected={selected}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? "bg-canvas-surface text-canvas-ink shadow-sm"
                      : "text-canvas-muted hover:text-canvas-ink"
                  }`}
                  id={`${tabPanelId}-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  title={tab.id === "engagements" ? tab.label : undefined}
                  type="button"
                >
                  {tab.id === "engagements" ? (
                    <Swords aria-hidden="true" className="mx-auto h-4 w-4" />
                  ) : tab.label}
                </button>
              );
            })}
          </div>
          <div
            aria-labelledby={`${tabPanelId}-${activeTab}`}
            className="space-y-4"
            id={tabPanelId}
            role="tabpanel"
          >
            <ColorPalette
              key={`${zone.id}:${palette.property}`} zoneId={zone.id}
              disabled={readOnly || (activeTab === "engagements" && matchesBorder)}
              label={palette.label}
              onCommitZoneProperties={onCommitZoneProperties}
              property={palette.property}
              value={palette.value}
            />
            {activeTab === "engagements" ? (
              <div className="rounded-xl border border-canvas-line px-3">
                <PreferenceSwitch
                  checked={matchesBorder}
                  disabled={readOnly}
                  compact
                  label="Match border color"
                  onChange={(matchEngagementColorToBorder) =>
                    onCommitZoneProperties({ matchEngagementColorToBorder })
                  }
                />
              </div>
            ) : null}
            {activeTab === "fill" ? (
              <label className="block space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-canvas-ink">Opacity</span>
                  <span className="font-mono text-[11px] text-canvas-muted">
                    {Math.round(opacityControl.draftOpacity * 100)}%
                  </span>
                </div>
                <input
                  aria-label="Zone opacity"
                  disabled={readOnly}
                  className="w-full accent-canvas-ink"
                  max="1"
                  min="0"
                  onBlur={opacityControl.handleBlur}
                  onChange={opacityControl.handleChange}
                  onPointerCancel={opacityControl.handlePointerCancel}
                  onPointerDown={opacityControl.handlePointerDown}
                  onPointerUp={opacityControl.handlePointerUp}
                  step="any"
                  type="range"
                  value={opacityControl.draftOpacity}
                />
              </label>
            ) : null}
            {activeTab === "border" ? (
              <div className="rounded-xl border border-canvas-line px-3">
                <PreferenceSwitch
                  checked={zone.showBorder}
                  disabled={readOnly}
                  compact
                  label="Show border"
                  onChange={(showBorder) => onCommitZoneProperties({ showBorder })}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
