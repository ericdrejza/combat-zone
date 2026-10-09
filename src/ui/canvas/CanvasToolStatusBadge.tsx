type CanvasToolStatusBadgeProps = {
  movementSummary?: string;
  actorNames: string[];
  activeToolId: string;
  edgeStatuses: string[];
  zoneStatuses: string[];
  zoneShapeMode: string;
};

export function CanvasToolStatusBadge({
  movementSummary,
  actorNames,
  activeToolId,
  edgeStatuses,
  zoneStatuses,
  zoneShapeMode
}: CanvasToolStatusBadgeProps) {
  const actorStatus =
    (activeToolId === "actor" || activeToolId === "select") && actorNames.length > 0
      ? actorNames.join(", ")
      : null;
  const zoneStatus =
    (activeToolId === "zone" || activeToolId === "select") &&
    zoneStatuses.length > 0
      ? zoneStatuses.join("; ")
      : null;
  const edgeStatus =
    (activeToolId === "edge" || activeToolId === "select") &&
    edgeStatuses.length > 0
      ? edgeStatuses.join("; ")
      : null;

  const info = movementSummary ??
    actorStatus ??
    zoneStatus ??
    edgeStatus ??
    (activeToolId === "zone" ? `Zone shape: ${zoneShapeMode}` : null);

  return (
    <div hidden={info == null} className="pointer-events-none absolute left-4
      top-4 max-h-[30%] max-w-[calc(100%-2rem)] overflow-y-auto break-words rounded-xl border border-canvas-line bg-canvas-panel/90
      mr-4 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-canvas-muted"
    >
      {info}
    </div>
  );
}
