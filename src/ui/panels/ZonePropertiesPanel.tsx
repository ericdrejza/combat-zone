import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Paintbrush,
  Trash2,
  Upload
} from "lucide-react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import type { LayoutOrientation } from "../../core/layout/types";
import { calculateZoneLayout } from "../../core/layout/encounterLayout";
import type { Zone } from "../../entities/zone/types";
import type { ZoneNamePosition } from "../../entities/zone/types";
import {
  deleteZone,
  type UpdateZonePropertiesInput,
  updateZoneProperties
} from "../../entities/zone/zoneMutations";
import {
  clearSelection,
  setLastZoneOpacity,
  toggleZonePaintBrush
} from "../../interaction/interactionState";
import { commitEncounterChange } from "../../store/encounterSlice";
import type { RootState } from "../../store/store";

const zoneLayoutStrategies: Zone["layoutStrategy"][] = [
  "FLEX",
  "SEQUENTIAL",
  "SPLIT_FLEX",
  "SPLIT_SEQUENTIAL"
];

const zoneLayoutOrientations: LayoutOrientation[] = ["LEFT_RIGHT", "TOP_BOTTOM"];
const zoneColorOptions = [
  "#ffffff",
  "#d6d3d1",
  "#AAAAAA",
  "#765341",
  "#92400e",
  "#fef3c7",
  "#fed7aa",
  "#fecaca",
  "#fbcfe8",
  "#ddd6fe",
  "#bfdbfe",
  "#bae6fd",
  "#bbf7d0",
  "#d9f99d",
  "#991b1b",
  "#fde68a",
  "#365314",
  "#047857",
  "#1d4ed8",
  "#6d28d9",
];
const zoneNamePositions: Array<{
  icon: typeof ArrowUpLeft;
  id: ZoneNamePosition;
  label: string;
}> = [
  { icon: ArrowUpLeft, id: "top-left", label: "Top left" },
  { icon: ArrowUpRight, id: "top-right", label: "Top right" },
  { icon: ArrowDownLeft, id: "bottom-left", label: "Bottom left" },
  { icon: ArrowDownRight, id: "bottom-right", label: "Bottom right" },
];

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getExportableZoneProperties(zone: Zone): UpdateZonePropertiesInput {
  return {
    colorBorder: zone.colorBorder,
    colorFill: zone.colorFill,
    layoutOrientation: zone.layoutOrientation,
    layoutStrategy: zone.layoutStrategy,
    namePosition: zone.namePosition,
    opacity: zone.opacity,
    showBorder: zone.showBorder,
    showName: zone.showName,
    tags: zone.tags
  };
}

function isSplitLayoutStrategy(strategy: Zone["layoutStrategy"]): boolean {
  return strategy.startsWith("SPLIT_");
}

export function ZonePropertiesHeaderActions() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const selectedZoneIds =
    selection.selectedEntityType === "zone" ? selection.selectedIds : [];
  const sourceZone = encounter.zones.byId[selectedZoneIds[0]];

  if (!sourceZone || selectedZoneIds.length < 2) {
    return null;
  }

  function exportSourcePropertiesToSelection() {
    const exportableProperties = getExportableZoneProperties(sourceZone);
    const nextEncounter = selectedZoneIds
      .slice(1)
      .reduce(
        (currentEncounter, zoneId) =>
          updateZoneProperties(currentEncounter, zoneId, exportableProperties),
        encounter
      );

    if (nextEncounter === encounter) {
      return;
    }

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.exportProperties", {
          properties: exportableProperties,
          sourceZoneId: sourceZone.id,
          targetZoneIds: selectedZoneIds.slice(1)
        }),
        nextEncounter
      })
    );
    dispatch(setLastZoneOpacity(sourceZone.opacity));
  }

  return (
    <button
      aria-label="Export first selected zone properties"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-muted transition hover:bg-canvas"
      onClick={exportSourcePropertiesToSelection}
      title="Export first selected zone properties"
      type="button"
    >
      <Upload aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

export function ZonePropertiesPanel() {
  const [colorSectionOpen, setColorSectionOpen] = useState(true);
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const zonePaintBrush = useSelector(
    (state: RootState) => state.interaction.zonePaintBrush
  );
  const selectedZoneId =
    selection.selectedEntityType === "zone" ? selection.selectedIds[0] : undefined;
  const selectedZone = selectedZoneId
    ? encounter.zones.byId[selectedZoneId]
    : undefined;

  function commitZoneProperties(properties: Partial<Zone>) {
    if (!selectedZone) {
      return;
    }

    const zonePatch = {
      ...(properties.layoutOrientation !== undefined
        ? { layoutOrientation: properties.layoutOrientation }
        : {}),
      ...(properties.layoutStrategy !== undefined
        ? { layoutStrategy: properties.layoutStrategy }
        : {}),
      ...(properties.colorBorder !== undefined
        ? { colorBorder: properties.colorBorder }
        : {}),
      ...(properties.colorFill !== undefined
        ? { colorFill: properties.colorFill }
        : {}),
      ...(properties.name !== undefined ? { name: properties.name } : {}),
      ...(properties.namePosition !== undefined
        ? { namePosition: properties.namePosition }
        : {}),
      ...(properties.opacity !== undefined ? { opacity: properties.opacity } : {}),
      ...(properties.showBorder !== undefined
        ? { showBorder: properties.showBorder }
        : {}),
      ...(properties.showName !== undefined
        ? { showName: properties.showName }
        : {}),
      ...(properties.tags !== undefined ? { tags: properties.tags } : {})
    };
    const nextEncounter = updateZoneProperties(
      encounter,
      selectedZone.id,
      zonePatch
    );

    if (nextEncounter === encounter) {
      return;
    }

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.updateProperties", {
          zoneId: selectedZone.id,
          properties: zonePatch
        }),
        nextEncounter
      })
    );

    if (properties.opacity !== undefined) {
      dispatch(setLastZoneOpacity(properties.opacity));
    }
  }

  function commitZoneDelete() {
    if (!selectedZone) {
      return;
    }

    const connectedEdgeIds = encounter.edges.allIds.filter((edgeId) => {
      const edge = encounter.edges.byId[edgeId];

      return (
        edge?.fromZoneId === selectedZone.id || edge?.toZoneId === selectedZone.id
      );
    });
    const containedActorIds = encounter.actors.allIds.filter(
      (actorId) => encounter.actors.byId[actorId]?.currentZoneId === selectedZone.id
    );
    const containedEngagementIds = encounter.engagements.allIds.filter(
      (engagementId) =>
        encounter.engagements.byId[engagementId]?.parentZoneId === selectedZone.id
    );
    const nextEncounter = deleteZone(encounter, selectedZone.id);

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.delete", {
          zoneId: selectedZone.id,
          connectedEdgeIds,
          containedActorIds,
          containedEngagementIds
        }),
        nextEncounter
      })
    );
    dispatch(clearSelection());
  }

  function activateZonePaintBrush() {
    if (!selectedZone) {
      return;
    }

    dispatch(
      toggleZonePaintBrush({
        sourceZoneId: selectedZone.id
      })
    );
  }

  if (!selectedZone) {
    return (
      <p className="text-sm text-canvas-muted">
        Select a zone to edit its name, layout strategy, tags, and deletion.
      </p>
    );
  }

  const layoutDescriptor = calculateZoneLayout(encounter, selectedZone.id).descriptor;

  function renderColorPalette(
    label: string,
    value: string,
    property: "colorFill" | "colorBorder"
  ) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-canvas-ink">{label}</span>
          <span className="font-mono text-[11px] uppercase text-canvas-muted">
            {value}
          </span>
        </div>
        <div
          aria-label={`${label} palette`}
          className="grid grid-cols-5 gap-2"
          role="group"
        >
          {zoneColorOptions.map((color) => (
            <button
              key={color}
              aria-label={`${label} ${color}`}
              aria-pressed={value === color}
              className={`h-8 rounded-full border transition ${
                value === color
                  ? "border-canvas-ink ring-2 ring-canvas-ink/25"
                  : "border-canvas-line"
              }`}
              onClick={() => commitZoneProperties({ [property]: color })}
              style={{ backgroundColor: color }}
              type="button"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div key={selectedZone.id} className="space-y-4 text-sm">
      <section className="space-y-3 rounded-2xl border border-canvas-line bg-white p-3">
        <h3 className="font-semibold text-canvas-ink">Name</h3>
        <label className="block space-y-1">
          <span className="font-semibold text-canvas-ink">Zone name</span>
          <input
            className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2"
            onBlur={(event) => {
              const name = event.currentTarget.value.trim() || selectedZone.name;

              if (name !== selectedZone.name) {
                commitZoneProperties({ name });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            type="text"
            defaultValue={selectedZone.name}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-canvas-line bg-white px-3 py-2">
          <span>
            <span className="block font-semibold text-canvas-ink">Show name</span>
          </span>
          <input
            checked={selectedZone.showName}
            className="h-5 w-5 accent-canvas-ink"
            onChange={(event) =>
              commitZoneProperties({ showName: event.currentTarget.checked })
            }
            type="checkbox"
          />
        </label>
        {selectedZone.showName ? (
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-canvas-ink">Position</span>
            <div
              aria-label="Zone name position"
              className="grid grid-cols-2 overflow-hidden rounded-xl border border-canvas-line bg-white"
              role="radiogroup"
            >
              {zoneNamePositions.map((position) => {
                const Icon = position.icon;
                const selected = selectedZone.namePosition === position.id;

                return (
                  <button
                    key={position.id}
                    aria-checked={selected}
                    aria-label={position.label}
                    className={`border-canvas-line p-2 odd:border-r [&:nth-child(-n+2)]:border-b ${
                      selected
                        ? "bg-canvas-ink text-white"
                        : "text-canvas-muted hover:bg-canvas-subtle"
                    }`}
                    onClick={() =>
                      commitZoneProperties({ namePosition: position.id })
                    }
                    role="radio"
                    type="button"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
      <section className="rounded-2xl border border-canvas-line bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            aria-expanded={colorSectionOpen}
            className="inline-flex items-center gap-2 font-semibold text-canvas-ink"
            onClick={() => setColorSectionOpen((isOpen) => !isOpen)}
            type="button"
          >
            {colorSectionOpen ? (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            )}
            Color
          </button>
          <button
            aria-pressed={zonePaintBrush?.sourceZoneId === selectedZone.id}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
              zonePaintBrush?.sourceZoneId === selectedZone.id
                ? "border-canvas-ink bg-canvas-ink text-white"
                : "border-canvas-line text-canvas-ink hover:bg-canvas"
            }`}
            onClick={activateZonePaintBrush}
            title="Paint zone colors"
            type="button"
          >
            <Paintbrush aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Paint zone colors</span>
          </button>
        </div>
        {colorSectionOpen ? (
          <div className="mt-4 space-y-4">
            {renderColorPalette("Fill color", selectedZone.colorFill, "colorFill")}
            <label className="block space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-canvas-ink">Opacity</span>
                <span className="font-mono text-[11px] text-canvas-muted">
                  {Math.round(selectedZone.opacity * 100)}%
                </span>
              </div>
              <input
                aria-label="Zone opacity"
                className="w-full accent-canvas-ink"
                max="1"
                min="0"
                onChange={(event) =>
                  commitZoneProperties({
                    opacity: Number(event.currentTarget.value)
                  })
                }
                step="0.05"
                type="range"
                value={selectedZone.opacity}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-canvas-line px-3 py-2">
              <span className="font-semibold text-canvas-ink">Show border</span>
              <input
                checked={selectedZone.showBorder}
                className="h-5 w-5 accent-canvas-ink"
                onChange={(event) =>
                  commitZoneProperties({ showBorder: event.currentTarget.checked })
                }
                type="checkbox"
              />
            </label>
            {renderColorPalette(
              "Border color",
              selectedZone.colorBorder,
              "colorBorder"
            )}
          </div>
        ) : null}
      </section>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Layout strategy</span>
        <select
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2"
          onChange={(event) =>
            commitZoneProperties({
              layoutStrategy: event.currentTarget.value as Zone["layoutStrategy"]
            })
          }
          value={selectedZone.layoutStrategy}
        >
          {zoneLayoutStrategies.map((strategy) => (
            <option key={strategy} value={strategy}>
              {strategy}
            </option>
          ))}
        </select>
      </label>
      {isSplitLayoutStrategy(selectedZone.layoutStrategy) ? (
        <label className="block space-y-1">
          <span className="font-semibold text-canvas-ink">Layout orientation</span>
          <select
            className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2"
            onChange={(event) =>
              commitZoneProperties({
                layoutOrientation: event.currentTarget.value as LayoutOrientation
              })
            }
            value={selectedZone.layoutOrientation}
          >
            {zoneLayoutOrientations.map((orientation) => (
              <option key={orientation} value={orientation}>
                {orientation}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Tags</span>
        <input
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2"
          defaultValue={selectedZone.tags.join(", ")}
          onBlur={(event) => {
            const tags = parseTags(event.currentTarget.value);

            if (tags.join("|") !== selectedZone.tags.join("|")) {
              commitZoneProperties({ tags });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          type="text"
        />
      </label>
      <div className="rounded-2xl border border-canvas-line bg-white p-3 text-xs text-canvas-muted">
        Current layout descriptor: {layoutDescriptor.strategy},{" "}
        {layoutDescriptor.orientation}, {layoutDescriptor.sections.length} section
        {layoutDescriptor.sections.length === 1 ? "" : "s"}.
      </div>
      <button
        className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700 transition hover:bg-red-100"
        onClick={commitZoneDelete}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Delete zone
      </button>
    </div>
  );
}
