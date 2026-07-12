type CanvasToolStatusBadgeProps = {
  actorNames: string[];
  activeToolId: string;
  zoneShapeMode: string;
};

export function CanvasToolStatusBadge({
  actorNames,
  activeToolId,
  zoneShapeMode
}: CanvasToolStatusBadgeProps) {
  const actorStatus =
    (activeToolId === "actor" || activeToolId === "select") && actorNames.length > 0
      ? actorNames.join(", ")
      : null;

  const info = actorStatus ?? (activeToolId === "zone" ? `Zone shape: ${zoneShapeMode}` : null)

  return (
    <div hidden={info == null} className="pointer-events-none absolute left-4 
      top-4 rounded-full border border-canvas-line bg-canvas-panel/90 
      mr-4 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-canvas-muted"
    >
      {info}
    </div>
  );
}
