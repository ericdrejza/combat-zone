import type { DragEvent } from "react";
import { useState } from "react";
import { getTextColorForLuminance } from "@ui/canvas/canvasLuminance";
import { useResizablePanel } from "@ui/canvas/useResizablePanel";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ZonelessActorPanelToken } from "./ZonelessActorPanelToken";
import { ZonelessPanelVisibility } from "./ZonelessPanelVisibility";
import { ZonelessPanelHeader, ZonelessFactionButton } from "./ZonelessPanelHeader";
import { useZonelessPanelActors } from "./useZonelessPanelActors";
export { getZonelessActors, getGroupedActors } from "./zonelessActorGroups";

type ZonelessActorPanelProps = {
  canvasBackgroundLuminance: number;
  isInBottomRow?: boolean;
  isActorDragActive: boolean;
  isZoneEditing?: boolean;
  onActorCreationDragOver: (event: DragEvent<HTMLElement>) => void;
  onActorCreationDrop: (event: DragEvent<HTMLElement>) => void;
  visible?: boolean;
};

export function ZonelessActorPanel({
  canvasBackgroundLuminance,
  isInBottomRow = false,
  isActorDragActive,
  isZoneEditing = false,
  onActorCreationDragOver,
  onActorCreationDrop,
  visible = true
}: ZonelessActorPanelProps) {
  const { zonelessActors, groups: groupedActors, selectedIds, canSelect, selectActors,
    handleSelect, handleDragStart, handleDragEnd, startPointerTransfer } = useZonelessPanelActors();
  const { zonelessHeaderClickExpansion } = useInterfacePreferences();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [groupByFaction, setGroupByFaction] = useState(true);
  const { isResized, isResizing, resetSize, size, startResize } = useResizablePanel();
  const contrastColor = hovered || focused ? "rgb(var(--color-canvas-ink))" : getTextColorForLuminance(canvasBackgroundLuminance);

  return (
    <ZonelessPanelVisibility
      visible={visible && !isZoneEditing}
      aria-label="Zoneless actors"
      className={`${isInBottomRow ? "relative min-w-0 translate-x-0" : "absolute bottom-3 left-1/2 min-w-0 -translate-x-1/2"} z-40 flex max-w-full flex-col overflow-hidden border p-2 hover:bg-canvas-panel focus-within:bg-canvas-panel ${
        expanded
          ? "rounded-2xl border-canvas-line bg-canvas-panel/10 shadow-lg backdrop-blur"
          : "rounded-lg bg-transparent"
      } ${
        isActorDragActive ? "border-canvas-ink ring-2 ring-canvas-ink/20" : ""
      } ${isResizing ? "select-none" : ""}`}
      data-drop-target="zoneless-actors"
      onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onDragOver={onActorCreationDragOver}
      onDrop={onActorCreationDrop}
      style={{
        height: expanded ? `${size.height}px` : undefined,
        maxWidth: isInBottomRow ? "100%" : "calc(100% - 12rem)",
        borderColor: contrastColor,
        color: contrastColor,
        width: `${size.width}px`
      }}
    >
      <ZonelessPanelHeader
        expanded={expanded} onToggle={() => setExpanded(current => !current)}
        headerClickExpansion={zonelessHeaderClickExpansion}
        groupByFaction={groupByFaction} onGroupChange={setGroupByFaction}
        count={zonelessActors.length} contrastColor={contrastColor}
        isResized={isResized} onResetSize={resetSize}
        canSelect={canSelect} onSelectAll={() => selectActors(zonelessActors)}
      />
      {expanded ? (
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto border-t border-canvas-line pt-2" style={{borderColor: contrastColor}}>
          {zonelessActors.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-canvas-muted">
              Drop actors here to remove them from the canvas.
            </p>
          ) : groupByFaction ? (
            <div className="flex flex-wrap gap-4">
              {groupedActors.map((group) => (
                <section className="border-x" aria-label={`${group.label} zoneless actors`} key={group.id}
                  style={{borderColor: contrastColor}}
                >
                  <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wide">
                    <ZonelessFactionButton group={group} disabled={!canSelect} onSelect={() => selectActors(group.actors)} />
                  </h3>
                  <div className="flex flex-row flex-wrap p-2 gap-1">
                    {group.actors.map((actor) => (
                      <ZonelessActorPanelToken
                        actor={actor}
                        key={actor.id}
                        onDragEnd={handleDragEnd}
                        onDragStart={handleDragStart}
                        onPointerDown={startPointerTransfer}
                        onSelect={handleSelect}
                        selectedIds={selectedIds}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {zonelessActors.map((actor) => (
                <ZonelessActorPanelToken
                  actor={actor}
                  key={actor.id}
                  onDragEnd={handleDragEnd}
                  onDragStart={handleDragStart}
                  onPointerDown={startPointerTransfer}
                  onSelect={handleSelect}
                  selectedIds={selectedIds}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
      {expanded ? (
        <>
          <button
            aria-label="Resize zoneless actors panel left edge"
            className="absolute bottom-2 left-0 top-2 w-2 cursor-ew-resize hover:bg-canvas-ink/10 focus-visible:ring-2 focus-visible:ring-canvas-ink"
            onMouseDown={(event) => startResize(event, "left")}
            title="Resize Zoneless panel"
            type="button"
          />
          <button
            aria-label="Resize zoneless actors panel right edge"
            className="absolute bottom-2 right-0 top-2 w-2 cursor-ew-resize hover:bg-canvas-ink/10 focus-visible:ring-2 focus-visible:ring-canvas-ink"
            onMouseDown={(event) => startResize(event, "right")}
            title="Resize Zoneless panel"
            type="button"
          />
          <button
            aria-label="Resize zoneless actors panel top edge"
            className="absolute left-2 right-2 top-0 h-2 cursor-ns-resize hover:bg-canvas-ink/10 focus-visible:ring-2 focus-visible:ring-canvas-ink"
            onMouseDown={(event) => startResize(event, "top")}
            title="Resize Zoneless panel"
            type="button"
          />
        </>
      ) : null}
    </ZonelessPanelVisibility>
  );
}
